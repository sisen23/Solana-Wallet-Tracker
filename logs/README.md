# Blockchain Transaction Tracker

A Node.js project demonstrating real-time blockchain transaction tracking and processing using WebSocket subscriptions and RPC calls. This code processes transactions into human readable transactions if the wallet uses PumpFun, Raydium, or Jupiter. These are the main three platforms used in the Solana ecosystem. Transactions outside of these are labeled Unkown with the signature. 

## Overview

This project processes blockchain transactions for platforms like **Pump.fun**, **Raydium**, and **Jupiter**, providing categorized transaction summaries and detailed decoding.

### Key Features
- Real-time tracking of wallet activities using WebSocket.
- Categorization and processing of transactions into relevant groups.
- Detailed decoding of transaction data for analysis.
- Error handling for reconnections and retries.

### Highlights
- **WebSocket Integration:** Establish and manage WebSocket connections to track blockchain logs in real-time.
- **Blockchain Expertise:** Decode and categorize transactions from the Solana blockchain.
- **Error Handling:** Implement reconnection logic and robust error handling for API calls.
- **Data Processing:** Extract meaningful insights from raw blockchain data.

## Code Structure
Here's a brief look at the project's main components:

- **`Main.mjs`**: Manages WebSocket connections, transaction categorization, and processing pipelines.
- **`Pumpfun.mjs`**: Decodes and formats transactions related to Pump.fun.
- **`Raydium.mjs`**: Processes and categorizes Raydium transactions.
- **`Jupiter.mjs`**: Handles transaction decoding and categorization for Jupiter.
- **`idl_pumpfun.json`**: Defines the interface for Pump.fun-related operations.

### Example Functionality

- **Real-Time Logs:**
  ```plaintext
  WebSocket for test1 (AxHrZRSv4VmvTy3pg36FKcU7eopvCDWSq8j6gGrKE5e1) established.
  Received signature: <signature> for test1 (AxHrZRSv4VmvTy3pg36FKcU7eopvCDWSq8j6gGrKE5e1)
  Raydium
  Swapped 1.23 SOL for 2.34 USDC
