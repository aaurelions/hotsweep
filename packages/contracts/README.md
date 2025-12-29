## 100% coverage

```
[⠊] Compiling...
[⠢] Compiling 52 files with Solc 0.8.29
[⠆] Solc 0.8.29 finished in 1.18s
Compiler run successful!
Analysing contracts...
Running tests...

Ran 1 test for test/HotSweep.t.sol:HotSweepScriptTest
[PASS] test_SweepScript() (gas: 970674)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 10.54ms (4.62ms CPU time)

Ran 1 test for test/Mocks.t.sol:MocksScriptTest
[PASS] test_MocksScript() (gas: 5029430)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 10.73ms (4.82ms CPU time)

Ran 25 tests for test/HotSweep.t.sol:HotSweepTest
[PASS] testConstructor() (gas: 8021)
[PASS] testConstructorSetsImmutableOwner() (gas: 961212)
[PASS] testExecuteBatchAuthSweep() (gas: 117370)
[PASS] testExecuteBatchAuthSweepAnyoneCanCall() (gas: 118330)
[PASS] testExecuteBatchAuthSweepMultiple() (gas: 187149)
[PASS] testExecuteBatchPermitSweep() (gas: 127544)
[PASS] testExecuteBatchPermitSweepMultiple() (gas: 204534)
[PASS] testExecuteBatchPermitSweepOnlyOwner() (gas: 14562)
[PASS] testExecuteBatchSweepERC20() (gas: 60258)
[PASS] testExecuteBatchSweepETH() (gas: 48661)
[PASS] testExecuteBatchSweepETHTransferFailed() (gas: 101180)
[PASS] testExecuteBatchSweepMultiple() (gas: 141252)
[PASS] testExecuteBatchSweepOnlyOwner() (gas: 12064)
[PASS] testOwnerReturnsImmutableOwner() (gas: 8066)
[PASS] testReceiveETH() (gas: 12989)
[PASS] testReceiveETHFromUser() (gas: 19030)
[PASS] testRenounceOwnershipReverts() (gas: 11427)
[PASS] testSweepAllETH() (gas: 45740)
[PASS] testSweepAllETHOnlyOwner() (gas: 12361)
[PASS] testSweepAllETHRevertsOnZeroBalance() (gas: 49107)
[PASS] testSweepAllETHTransferFailed() (gas: 97717)
[PASS] testSweepAllTokens() (gas: 63783)
[PASS] testSweepAllTokensOnlyOwner() (gas: 50773)
[PASS] testSweepAllTokensRevertsOnZeroBalance() (gas: 22819)
[PASS] testTransferOwnershipReverts() (gas: 14127)
Suite result: ok. 25 passed; 0 failed; 0 skipped; finished in 18.25ms (35.23ms CPU time)

Ran 25 tests for test/Mocks.t.sol:MocksTest
[PASS] testMockDLGTDeployment() (gas: 28796)
[PASS] testMockDLGTMint() (gas: 41112)
[PASS] testMockDLGTMintMultiple() (gas: 70139)
[PASS] testMockDLGTTransfer() (gas: 40406)
[PASS] testMockLGCYDeployment() (gas: 29050)
[PASS] testMockLGCYMint() (gas: 41155)
[PASS] testMockLGCYMintMultiple() (gas: 74930)
[PASS] testMockLGCYTransfer() (gas: 40442)
[PASS] testMockPRMTDeployment() (gas: 28733)
[PASS] testMockPRMTDomainSeparator() (gas: 5943)
[PASS] testMockPRMTMint() (gas: 41161)
[PASS] testMockPRMTNonces() (gas: 13897)
[PASS] testMockPRMTPermit() (gas: 108348)
[PASS] testMockUSDCAuthorizationStateFunction() (gas: 108987)
[PASS] testMockUSDCAuthorizationStatesPublic() (gas: 8430)
[PASS] testMockUSDCDecimals() (gas: 5812)
[PASS] testMockUSDCDeployment() (gas: 28734)
[PASS] testMockUSDCDomainSeparator() (gas: 5899)
[PASS] testMockUSDCMint() (gas: 41114)
[PASS] testMockUSDCTransferWithAuthorization() (gas: 109345)
[PASS] testMockUSDCTransferWithAuthorizationRevertsExpired() (gas: 53098)
[PASS] testMockUSDCTransferWithAuthorizationRevertsInvalidSignature() (gas: 59813)
[PASS] testMockUSDCTransferWithAuthorizationRevertsNotYetValid() (gas: 53171)
[PASS] testMockUSDCTransferWithAuthorizationRevertsUsedNonce() (gas: 108856)
[PASS] testMockUSDCTransferWithAuthorizationTypehash() (gas: 5821)
Suite result: ok. 25 passed; 0 failed; 0 skipped; finished in 18.42ms (47.07ms CPU time)

Ran 4 test suites in 269.08ms (57.94ms CPU time): 52 tests passed, 0 failed, 0 skipped (52 total tests)

╭-----------------------+-----------------+-----------------+-----------------+-----------------╮
| File                  | % Lines         | % Statements    | % Branches      | % Funcs         |
+===============================================================================================+
| script/HotSweep.s.sol | 100.00% (6/6)   | 100.00% (6/6)   | 100.00% (0/0)   | 100.00% (1/1)   |
|-----------------------+-----------------+-----------------+-----------------+-----------------|
| script/Mocks.s.sol    | 100.00% (11/11) | 100.00% (14/14) | 100.00% (0/0)   | 100.00% (1/1)   |
|-----------------------+-----------------+-----------------+-----------------+-----------------|
| src/HotSweep.sol      | 100.00% (33/33) | 100.00% (33/33) | 100.00% (10/10) | 100.00% (9/9)   |
|-----------------------+-----------------+-----------------+-----------------+-----------------|
| src/Mocks.sol         | 100.00% (42/42) | 100.00% (33/33) | 100.00% (8/8)   | 100.00% (12/12) |
|-----------------------+-----------------+-----------------+-----------------+-----------------|
| test/HotSweep.t.sol   | 100.00% (2/2)   | 100.00% (1/1)   | 100.00% (0/0)   | 100.00% (1/1)   |
|-----------------------+-----------------+-----------------+-----------------+-----------------|
| Total                 | 100.00% (94/94) | 100.00% (87/87) | 100.00% (18/18) | 100.00% (24/24) |
╰-----------------------+-----------------+-----------------+-----------------+-----------------╯
```
