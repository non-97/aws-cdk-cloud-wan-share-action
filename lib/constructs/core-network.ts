import * as networkmanager from "aws-cdk-lib/aws-networkmanager";
import { Construct } from "constructs";
import {
  CORE_NETWORK_CONFIG,
  cloudWanNfg,
  cloudWanSegment,
  cloudWanTagKey,
} from "../network-config";

export interface CoreNetworkProps {
  readonly region: string;
}

export class CoreNetwork extends Construct {
  public readonly globalNetworkId: string;
  public readonly coreNetworkId: string;
  public readonly coreNetworkArn: string;

  constructor(scope: Construct, id: string, props: CoreNetworkProps) {
    super(scope, id);

    const globalNetwork = new networkmanager.CfnGlobalNetwork(
      this,
      "GlobalNetwork",
      {
        description: "Global Network for Cloud WAN Share Demo",
      }
    );

    const coreNetwork = new networkmanager.CfnCoreNetwork(this, "CoreNetwork", {
      description: "Core Network for Cloud WAN Share Demo",
      globalNetworkId: globalNetwork.attrId,
      policyDocument: {
        version: "2021.12",
        "core-network-configuration": {
          "vpn-ecmp-support": true,
          "inside-cidr-blocks": CORE_NETWORK_CONFIG.insideCidrBlocks,
          "asn-ranges": CORE_NETWORK_CONFIG.asnRanges,
          "edge-locations": [
            { location: props.region, asn: CORE_NETWORK_CONFIG.edgeAsn },
          ],
        },
        segments: [
          {
            name: cloudWanSegment.Share,
            "require-attachment-acceptance": false,
            "edge-locations": [props.region],
          },
          {
            name: cloudWanSegment.Prod,
            "require-attachment-acceptance": false,
            "isolate-attachments": false,
            "edge-locations": [props.region],
          },
          {
            name: cloudWanSegment.Dev,
            "require-attachment-acceptance": false,
            "isolate-attachments": false,
            "edge-locations": [props.region],
          },
        ],
        "network-function-groups": [
          {
            name: cloudWanNfg.Security,
            "require-attachment-acceptance": false,
          },
        ],
        "segment-actions": [
          {
            action: "share",
            mode: "attachment-route",
            segment: cloudWanSegment.Share,
            "share-with": [cloudWanSegment.Prod, cloudWanSegment.Dev],
          },
        ],
        "attachment-policies": [
          ...(
            [
              { ruleNumber: 100, segment: cloudWanSegment.Share },
              { ruleNumber: 200, segment: cloudWanSegment.Prod },
              { ruleNumber: 300, segment: cloudWanSegment.Dev },
            ] as const
          ).map(({ ruleNumber, segment }) => ({
            "rule-number": ruleNumber,
            description: `attachment segment ${segment}`,
            "condition-logic": "or",
            conditions: [
              {
                type: "tag-value",
                operator: "equals",
                key: cloudWanTagKey.Segment,
                value: segment,
              },
            ],
            action: {
              "association-method": "constant",
              segment,
            },
          })),
          {
            "rule-number": 400,
            description: "attachment nfg security",
            "condition-logic": "or",
            conditions: [
              {
                type: "tag-value",
                operator: "equals",
                key: cloudWanTagKey.Nfg,
                value: cloudWanNfg.Security,
              },
            ],
            action: {
              "add-to-network-function-group": cloudWanNfg.Security,
            },
          },
        ],
      },
    });

    this.globalNetworkId = globalNetwork.attrId;
    this.coreNetworkId = coreNetwork.attrCoreNetworkId;
    this.coreNetworkArn = coreNetwork.attrCoreNetworkArn;
  }
}
