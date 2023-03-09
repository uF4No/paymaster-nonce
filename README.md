# Paymaster nonce issue

The `_transaction.nonce` in the paymaster is 0 instead of the actual nonce of the account that sent a transaction via the paymaster.

To test, I created a paymaster contract that reverts if the transaction is 0.

To replicate issue:

- Install deps with `yarn`
- Compile contracts `yarn hardhat compile`
- Start local-setup in a different terminal
- Run tests with `yarn test`
