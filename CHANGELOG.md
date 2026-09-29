# Changelog

## [1.126.0](https://github.com/safe-global/safe-client-gateway/compare/v1.125.0...v1.126.0) (2026-09-29)


### Features

* add the policies entitlement ([#3487](https://github.com/safe-global/safe-client-gateway/issues/3487)) ([55fa83e](https://github.com/safe-global/safe-client-gateway/commit/55fa83e506c57ab9f9ec5a8221cb3e1017c8048c))
* **ci:** add release-please as an opt-in release pipeline ([#3490](https://github.com/safe-global/safe-client-gateway/issues/3490)) ([6185768](https://github.com/safe-global/safe-client-gateway/commit/6185768f92cecb0320155669edb83f8f2450e2a4))
* **ci:** move production onto the event-driven pipeline and delete ci.yml ([#3493](https://github.com/safe-global/safe-client-gateway/issues/3493)) ([2db5dd3](https://github.com/safe-global/safe-client-gateway/commit/2db5dd31b13e3253ad7c89d8735c58110a34fabe))
* **circuit-breaker:** cap in-flight probes while HALF_OPEN ([#3442](https://github.com/safe-global/safe-client-gateway/issues/3442)) ([043bea7](https://github.com/safe-global/safe-client-gateway/commit/043bea72becb0b3719cf24e24d169b1adf37252d))
* count a Safe on several chains as one seat ([#3446](https://github.com/safe-global/safe-client-gateway/issues/3446)) ([0daa4bf](https://github.com/safe-global/safe-client-gateway/commit/0daa4bf72ff577384e57738b62b309c944dfb1f4))
* expose whether a subscription has a payment method ([#3485](https://github.com/safe-global/safe-client-gateway/issues/3485)) ([8588a9d](https://github.com/safe-global/safe-client-gateway/commit/8588a9dad339b4b22e4cebb75170d2552f15bc61))
* gate Copilot recipient/counterparty scans by plan entitlement ([#3454](https://github.com/safe-global/safe-client-gateway/issues/3454)) ([92e33fe](https://github.com/safe-global/safe-client-gateway/commit/92e33fecc14a3c92f30361b67438f429dc3dc4c6))
* **policies:** add the policy indexer client for allowance-module state ([#3392](https://github.com/safe-global/safe-client-gateway/issues/3392)) ([22a7ca4](https://github.com/safe-global/safe-client-gateway/commit/22a7ca46d7d24051985a4c3d2c1a20e214671b76))
* **policies:** add the shared policy domain model ([#3391](https://github.com/safe-global/safe-client-gateway/issues/3391)) ([3728efc](https://github.com/safe-global/safe-client-gateway/commit/3728efc812c7aee576a84cdd9d30e7de1389a380))
* **policies:** fetch proposers in policies api ([#3451](https://github.com/safe-global/safe-client-gateway/issues/3451)) ([e539b12](https://github.com/safe-global/safe-client-gateway/commit/e539b12341c8783d5bbe3427bda69cb920609d6b))
* **policies:** serve active spending-limit policies for a space ([#3393](https://github.com/safe-global/safe-client-gateway/issues/3393)) ([6aab05d](https://github.com/safe-global/safe-client-gateway/commit/6aab05d04276b54cc1534da7eab19f67e2d23e96))
* **queue-service:** Integrate queue service ([#3223](https://github.com/safe-global/safe-client-gateway/issues/3223)) ([12bb3a6](https://github.com/safe-global/safe-client-gateway/commit/12bb3a6d62170c9c047b803fd3d2b7e8110b5551))
* sponsor relays against a workspace's plan allowance ([#3437](https://github.com/safe-global/safe-client-gateway/issues/3437)) ([f6a1277](https://github.com/safe-global/safe-client-gateway/commit/f6a1277e98345efe0e7f2333724281008c7e52dc))
* store the plan code of each subscription ([#3492](https://github.com/safe-global/safe-client-gateway/issues/3492)) ([09ef6dc](https://github.com/safe-global/safe-client-gateway/commit/09ef6dc81ff07eb232b15fb714b7c6c8fdf66ecf))
* update Nest to 12 ([#3443](https://github.com/safe-global/safe-client-gateway/issues/3443)) ([653b609](https://github.com/safe-global/safe-client-gateway/commit/653b609df22037c795546274d3b2cf7ce71aa2ec))


### Bug Fixes

* match the active plan's price, not its display name ([#3445](https://github.com/safe-global/safe-client-gateway/issues/3445)) ([2f860c4](https://github.com/safe-global/safe-client-gateway/commit/2f860c445d2815b9f4bf9ea03a692102cb2d2d50))
* **messages:** stop logging signed message content ([#3456](https://github.com/safe-global/safe-client-gateway/issues/3456)) ([db4640a](https://github.com/safe-global/safe-client-gateway/commit/db4640a69e941ae62af0501aa3738d282203c249))
* pin dd-trace package to load traces in DD ([#3486](https://github.com/safe-global/safe-client-gateway/issues/3486)) ([13e000e](https://github.com/safe-global/safe-client-gateway/commit/13e000ecc50c36793bed0d362be725c64267c169))
* **policies:** type addresses and the enforcement union in the OpenAPI doc ([#3494](https://github.com/safe-global/safe-client-gateway/issues/3494)) ([bb4ea72](https://github.com/safe-global/safe-client-gateway/commit/bb4ea7288f68cfede77f135bac75a080956e6fb6))
* reject an empty chainId instead of returning 502 ([#3397](https://github.com/safe-global/safe-client-gateway/issues/3397)) ([b0da684](https://github.com/safe-global/safe-client-gateway/commit/b0da6840b8a293b0f941465df35ff8936b827a7a))
* **safe-queue:** map a null `to` from the Queue Service to the zero address ([#3455](https://github.com/safe-global/safe-client-gateway/issues/3455)) ([252f2d2](https://github.com/safe-global/safe-client-gateway/commit/252f2d27a3f35c1cfd0f260cb8b9d82a93ed5b01))
* **safe-queue:** stop parsing tx-service response in postConfirmation ([#3458](https://github.com/safe-global/safe-client-gateway/issues/3458)) ([daeb592](https://github.com/safe-global/safe-client-gateway/commit/daeb5925badf758d69596f5d9cc8a91d686f49a7))
* **transactions:** declare TransactionDetails as the add-confirmation response ([#3460](https://github.com/safe-global/safe-client-gateway/issues/3460)) ([0056b6d](https://github.com/safe-global/safe-client-gateway/commit/0056b6d5c3fa96674f002cfd89602b54832fafc9))
* use the renamed countSeatsBySpaceId in seat-capacity check ([#3457](https://github.com/safe-global/safe-client-gateway/issues/3457)) ([ef9d503](https://github.com/safe-global/safe-client-gateway/commit/ef9d503088f25fd960b3c8b5baad15d92640ca0c))
