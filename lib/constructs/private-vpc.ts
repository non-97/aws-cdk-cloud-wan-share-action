import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as networkmanager from 'aws-cdk-lib/aws-networkmanager';
import { Construct } from 'constructs';
import { CloudWanSegment, RFC1918_CIDRS, cloudWanTagKey } from '../network-config';

export interface PrivateVpcProps {
  readonly vpcCidr: string;
  readonly coreNetworkId: string;
  readonly coreNetworkArn: string;
  readonly segmentTag: CloudWanSegment;
}

export class PrivateVpc extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly instance: ec2.Instance;
  public readonly attachment: networkmanager.CfnVpcAttachment;

  constructor(scope: Construct, id: string, props: PrivateVpcProps) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 1,
      natGateways: 0,
      restrictDefaultSecurityGroup: false,
      subnetConfiguration: [
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
        { name: 'CloudWan', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const privateSubnet = vpc.selectSubnets({ subnetGroupName: 'Private' }).subnets[0];
    const cloudWanSubnet = vpc.selectSubnets({ subnetGroupName: 'CloudWan' }).subnets[0];

    const attachment = new networkmanager.CfnVpcAttachment(this, 'CloudWanAttachment', {
      coreNetworkId: props.coreNetworkId,
      vpcArn: vpc.vpcArn,
      subnetArns: [
        cdk.Arn.format(
          { service: 'ec2', resource: 'subnet', resourceName: cloudWanSubnet.subnetId },
          cdk.Stack.of(this),
        ),
      ],
      tags: [{ key: cloudWanTagKey.Segment, value: props.segmentTag }],
    });

    const privateDefaultRoute = new ec2.CfnRoute(this, 'PrivateSubnetDefaultRoute', {
      routeTableId: privateSubnet.routeTable.routeTableId,
      destinationCidrBlock: '0.0.0.0/0',
      coreNetworkArn: props.coreNetworkArn,
    });
    privateDefaultRoute.addDependency(attachment);

    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      allowAllOutbound: true,
    });
    for (const cidr of RFC1918_CIDRS) {
      ec2Sg.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.allTraffic());
    }

    const instance = new ec2.Instance(this, 'Instance', {
      vpc,
      vpcSubnets: { subnets: [privateSubnet] },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64',
      ),
      securityGroup: ec2Sg,
      ssmSessionPermissions: true,
    });

    const eicSg = new ec2.SecurityGroup(this, 'EicSg', {
      vpc,
      allowAllOutbound: false,
    });
    eicSg.addEgressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(22));

    new ec2.CfnInstanceConnectEndpoint(this, 'EicEndpoint', {
      subnetId: privateSubnet.subnetId,
      securityGroupIds: [eicSg.securityGroupId],
    });

    this.vpc = vpc;
    this.instance = instance;
    this.attachment = attachment;
  }
}
