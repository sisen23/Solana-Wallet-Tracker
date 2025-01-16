/**
 * Main.mjs: Entry point for tracking blockchain transactions using WebSocket subscriptions.
 * Features:
 * - Tracks wallets for specific blockchain events.
 * - Categorizes and processes transactions for Pump.fun, Raydium, and Jupiter.
 */


import WebSocket from 'ws';
import fetch from 'node-fetch';
import dotenv from 'dotenv'; // Import dotenv

dotenv.config({ path: '../config/.env' }); // Load environment variables from .env file

import { decodeAndFormatTransaction } from './Pumpfun.mjs';
import { classifyAndLogTransaction } from './Raydium.mjs';
import { decodeJupiterTransaction } from './Jupiter.mjs';

// Initialize an empty array to store transactions
let transactions = [];

// Load sensitive information from environment variables
const WSS_ENDPOINT = process.env.WSS_ENDPOINT;
const RPC_URL = process.env.RPC_URL;

// List of wallets to track with names
const walletsToTrack = [
    { name: 'test1', address: 'AxHrZRSv4VmvTy3pg36FKcU7eopvCDWSq8j6gGrKE5e1' },
    { name: 'test2', address: 'BcJZmCdbzRZvCuFMRPmg6oSQ7XSoVTGN4afuJSQojAXL' },
    { name: 'test3', address: '5Nj4diJyDCeb7dNwXxCQVpChEC5Y37kcCmjtWezKDbce' },
];

// Establish WebSocket connection for each wallet
function connectWebSocketForWallet({ name, address }) {
    const ws = new WebSocket(WSS_ENDPOINT);

    ws.on('open', () => {
        console.log(`WebSocket for ${name} (${address}) established.`);
        const subscribeMessage = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'logsSubscribe',
            params: [{ mentions: [address] }, { commitment: 'confirmed' }]
        });
        ws.send(subscribeMessage);
        console.log(`Sent logs subscription for: ${name} (${address})`);
    });

    ws.on('message', async (data) => {
        try {
            const logEntry = JSON.parse(data);
            const signature = logEntry?.params?.result?.value?.signature;
            if (signature) {
                console.log(`Received signature: ${signature} for ${name} (${address})`);
                await subscribeToSignatureFinalized(signature, name, address);
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });

    ws.on('close', () => {
        console.error(`WebSocket for ${name} (${address}) closed. Reconnecting in 5 seconds...`);
        setTimeout(() => connectWebSocketForWallet({ name, address }), 2000);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${name} (${address}):`, error);
        ws.close();
    });
}

// Subscribe to individual signature updates
async function subscribeToSignatureFinalized(signature, name, address) {
    const ws = new WebSocket(WSS_ENDPOINT);

    ws.on('open', () => {
        console.log(`Subscribing to signature: ${signature} with finalized commitment.`);
        const subscribeMessage = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'signatureSubscribe',
            params: [signature, { commitment: 'finalized', enableReceivedNotification: false }]
        });
        ws.send(subscribeMessage);
    });

    ws.on('message', async (data) => {
        try {
            const result = JSON.parse(data);
            if (result.params?.result) {
                console.log(`Signature ${signature} finalized. Processing for ${name} (${address})...`);
                await fetchTransactionDetails(signature, name, address);
            }
        } catch (error) {
            console.error('Error processing signature subscription:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Signature subscription for ${signature} closed.`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for signature ${signature}:`, error);
    });
}

// Fetch and process transaction details
async function fetchTransactionDetails(signature, name, address, retries = 3) {
    const headers = { 'Content-Type': 'application/json' };
    const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }]
    };

    try {
        const response = await fetch(RPC_URL, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await response.json();

        if (data.result) {
            const logMessages = data.result.meta.logMessages || [];

            if (logMessages.some(msg => msg.includes('Slippage tolerance exceeded'))) {
                console.log(`Skipping transaction ${signature} due to slippage tolerance.`);
                return;
            }

            const category = categorizeTransaction(logMessages);
            const tx = { ...data, category };
            transactions.push(tx);

            console.log(`\x1b[35m${name} (${address})\x1b[0m`);
            console.log(formatTransactionMessage(tx));

            if (category === 'Pump.fun') await processPumpfunTransaction(tx);
            else if (category === 'Raydium') await processRaydiumTransaction(tx);
            else if (category === 'Jupiter') await processJupiterTransaction(tx);
        } else if (retries > 0) {
            console.warn(`Transaction ${signature} not found. Retrying...`);
            await fetchTransactionDetails(signature, name, address, retries - 1);
        } else {
            console.log(`Transaction ${signature} not found after retries.`);
        }
    } catch (error) {
        console.error(`Error fetching transaction ${signature}:`, error);
    }
}

// Format transaction message with wallet name and address
function formatTransactionMessage(tx) {
    const details = tx.result.meta.postTokenBalances.map(balance =>
        `${balance.uiTokenAmount.uiAmount} ${balance.mint}`
    ).join(', ');

    return `${tx.category}`;
}

// Process Pump.fun transactions
async function processPumpfunTransaction(tx) {
    const signature = tx.result.transaction.signatures[0];
    const instructions = tx.result.meta.innerInstructions;
    const uniqueSignatures = new Set();

    if (!uniqueSignatures.has(signature)) {
        for (const inner of instructions) {
            for (const instruction of inner.instructions) {
                if (instruction.data && instruction.data.length >= 150) {
                    const decodedTransaction = await decodeAndFormatTransaction(instruction.data);
                    console.log(decodedTransaction);
                    uniqueSignatures.add(signature);
                }
            }
        }
    }
}

// Process Raydium transactions
async function processRaydiumTransaction(tx) {
    const signature = tx.result.transaction.signatures[0];
    const preTokenBalances = tx.result.meta.preTokenBalances || [];
    const postTokenBalances = tx.result.meta.postTokenBalances || [];
    const balanceDifferences = calculateDifference(preTokenBalances, postTokenBalances);

    await classifyAndLogTransaction({ signature, balanceDifferences });
}

// Process Jupiter transactions
async function processJupiterTransaction(tx) {
    const signature = tx.result.transaction.signatures[0];
    //console.log(`${signature}`);
    const decodedDetails = await decodeJupiterTransaction(signature);
    if (decodedDetails) console.log(`${decodedDetails}`);
}

// Calculate token balance differences
function calculateDifference(preBalances, postBalances) {
    const differences = [];
    postBalances.forEach(post => {
        const preMatch = preBalances.find(pre => pre.mint === post.mint && pre.owner === post.owner);
        const diff = preMatch
            ? parseFloat(post.uiTokenAmount.uiAmountString) - parseFloat(preMatch.uiTokenAmount.uiAmountString)
            : parseFloat(post.uiTokenAmount.uiAmountString);
        if (diff !== 0) differences.push({ mint: post.mint, difference: diff });
    });
    return differences;
}

// Categorize transactions
function categorizeTransaction(logMessages) {
    if (logMessages.some(msg => msg.includes('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'))) return 'Jupiter';
    if (logMessages.some(msg => msg.includes('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'))) return 'Raydium';
    if (logMessages.some(msg => msg.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'))) return 'Pump.fun';
    return 'Unknown';
}

// Start tracking all wallets
walletsToTrack.forEach(wallet => connectWebSocketForWallet(wallet));
