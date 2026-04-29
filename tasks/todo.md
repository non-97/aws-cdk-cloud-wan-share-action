# Cloud WAN Share 構成 実装計画

## ゴール
画像のとおり、ap-northeast-1 リージョンに Cloud WAN Core Network と 4 VPC を構築する。

- Core Network segments: `share` / `prod` / `dev`
- Network Function Group: `security` (Inspection VPC を attach)
- segment-actions: Share -> Prod / Dev に attachment-route を share する (一方向)
- Inspection VPC: Public(NAT) + Firewall(NFW endpoint) + CloudWan
- Share / Prod / Dev Private VPC: Private(EC2) + CloudWan

## 方針メモ
- AZ 数は 1 (参照リポジトリ準拠)
- AWS Network Firewall は実体として構築。STRICT_ORDER で `pass any any` を最後、その前に ICMP echo と TLS SNI / HTTP host が checkip.amazonaws.com を `alert`、CloudWatch Logs に出力
- Prod / Dev は `isolate-attachments: true` で同 segment 内 attachment 同士を分離
- 各 Private VPC のテスト用 EC2 は SSM 権限付き、EIC で接続
- `send-via` は使用しない (Inspection VPC は構成だけ作る)

## TODO
- [x] tasks/todo.md 作成
- [ ] lib/network-config.ts 作成
- [ ] lib/constructs/core-network.ts 作成 (segment-actions の share はユーザー貢献ポイント)
- [ ] lib/constructs/inspection-vpc.ts 作成
- [ ] lib/constructs/private-vpc.ts 作成
- [ ] lib/constructs/index.ts 作成
- [ ] lib/aws-cdk-cloud-wan-share-stack.ts 全体組み立て
- [ ] bin/aws-cdk-cloud-wan-share.ts に env を設定
- [ ] tsc --noEmit で型チェック
- [ ] ユーザーが segment-actions の share ブロックを実装

## 学習モードの貢献ポイント
`lib/constructs/core-network.ts` の `segment-actions: []` 配列を埋める。
ここは Cloud WAN ポリシーの「意図」がコードに現れる最重要部分。
share アクションの mode は `attachment-route` か `segment-route` か、
share-with は明示列挙 `[Prod, Dev]` か `"*"` か、トレードオフがある。
