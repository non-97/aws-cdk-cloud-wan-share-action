import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { CoreNetwork, InspectionVpc, PrivateVpc } from './constructs';
import { NETWORK_CONFIG, cloudWanSegment } from './network-config';

export class AwsCdkCloudWanShareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;

    const coreNetwork = new CoreNetwork(this, 'CoreNetwork', { region });

    new InspectionVpc(this, 'InspectionVpc', {
      vpcCidr: NETWORK_CONFIG.inspection.vpcCidr,
      coreNetworkId: coreNetwork.coreNetworkId,
      coreNetworkArn: coreNetwork.coreNetworkArn,
    });

    new PrivateVpc(this, 'ShareVpc', {
      vpcCidr: NETWORK_CONFIG.share.vpcCidr,
      coreNetworkId: coreNetwork.coreNetworkId,
      coreNetworkArn: coreNetwork.coreNetworkArn,
      segmentTag: cloudWanSegment.Share,
    });

    new PrivateVpc(this, 'ProdVpc', {
      vpcCidr: NETWORK_CONFIG.prod.vpcCidr,
      coreNetworkId: coreNetwork.coreNetworkId,
      coreNetworkArn: coreNetwork.coreNetworkArn,
      segmentTag: cloudWanSegment.Prod,
    });

    new PrivateVpc(this, 'DevVpc', {
      vpcCidr: NETWORK_CONFIG.dev.vpcCidr,
      coreNetworkId: coreNetwork.coreNetworkId,
      coreNetworkArn: coreNetwork.coreNetworkArn,
      segmentTag: cloudWanSegment.Dev,
    });
  }
}
