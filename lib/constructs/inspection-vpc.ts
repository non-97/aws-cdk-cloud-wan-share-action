import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nfw from 'aws-cdk-lib/aws-networkfirewall';
import * as networkmanager from 'aws-cdk-lib/aws-networkmanager';
import { Construct } from 'constructs';
import { cloudWanNfg, cloudWanTagKey } from '../network-config';

export interface InspectionVpcProps {
  readonly vpcCidr: string;
  readonly coreNetworkId: string;
  readonly coreNetworkArn: string;
}

export class InspectionVpc extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly attachment: networkmanager.CfnVpcAttachment;

  constructor(scope: Construct, id: string, props: InspectionVpcProps) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 1,
      natGateways: 1,
      restrictDefaultSecurityGroup: false,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Firewall', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'CloudWan', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const publicSubnet = vpc.selectSubnets({ subnetGroupName: 'Public' }).subnets[0];
    const fwSubnet = vpc.selectSubnets({ subnetGroupName: 'Firewall' }).subnets[0];
    const cloudWanSubnet = vpc.selectSubnets({ subnetGroupName: 'CloudWan' }).subnets[0];

    const alertRuleGroup = new nfw.CfnRuleGroup(this, 'AlertRuleGroup', {
      ruleGroupName: 'AwsCnVpc2F340095-RuleGroup',
      capacity: 1000,
      type: 'STATEFUL',
      ruleGroup: {
        statefulRuleOptions: { ruleOrder: 'STRICT_ORDER' },
        rulesSource: {
          rulesString: [
            'pass tls any any -> any any (ssl_state:client_hello; tls.sni; content:"checkip.amazonaws.com"; flow:to_server,established; alert; sid:2000001; rev:1; msg:"Access to checkip.amazonaws.com detected";)',
            'pass icmp any any -> any any (alert; sid:2000002; rev:1; msg:"ICMP ping detected";)',
            'pass tcp any any -> any any (flow:not_established; sid:3000001; rev:1;)',
            'pass tls any any -> any any (ssl_state:client_hello; flow:to_server,established; sid:3000002; rev:1;)',
            'pass tcp any any -> any any (flow:established; sid:3000003; rev:1;)',
            'pass udp any any -> any any (sid:3000004; rev:1;)',
            '',
          ].join('\n'),
        },
      },
    });

    const fwPolicy = new nfw.CfnFirewallPolicy(this, 'FirewallPolicy', {
      firewallPolicyName: 'AwsCnVpc2F340095-Policy',
      firewallPolicy: {
        statelessDefaultActions: ['aws:forward_to_sfe'],
        statelessFragmentDefaultActions: ['aws:forward_to_sfe'],
        statefulEngineOptions: {
          ruleOrder: 'STRICT_ORDER',
        },
        statefulDefaultActions: ['aws:drop_established'],
        statefulRuleGroupReferences: [
          { resourceArn: alertRuleGroup.attrRuleGroupArn, priority: 1 },
        ],
      },
    });

    const firewall = new nfw.CfnFirewall(this, 'Firewall', {
      firewallName: cdk.Names.uniqueResourceName(this, { maxLength: 32 }),
      firewallPolicyArn: fwPolicy.attrFirewallPolicyArn,
      vpcId: vpc.vpcId,
      subnetMappings: [{ subnetId: fwSubnet.subnetId }],
    });

    const alertLogGroup = new logs.LogGroup(this, 'AlertLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new nfw.CfnLoggingConfiguration(this, 'FirewallLogging', {
      firewallArn: firewall.attrFirewallArn,
      loggingConfiguration: {
        logDestinationConfigs: [
          {
            logType: 'ALERT',
            logDestinationType: 'CloudWatchLogs',
            logDestination: { logGroup: alertLogGroup.logGroupName },
          },
        ],
      },
    });

    const fwEndpointId = cdk.Fn.select(
      1,
      cdk.Fn.split(':', cdk.Fn.select(0, firewall.attrEndpointIds)),
    );

    const attachment = new networkmanager.CfnVpcAttachment(this, 'CloudWanAttachment', {
      coreNetworkId: props.coreNetworkId,
      vpcArn: vpc.vpcArn,
      subnetArns: [
        cdk.Arn.format(
          { service: 'ec2', resource: 'subnet', resourceName: cloudWanSubnet.subnetId },
          cdk.Stack.of(this),
        ),
      ],
      options: { applianceModeSupport: true },
      tags: [{ key: cloudWanTagKey.Nfg, value: cloudWanNfg.Security }],
    });

    new ec2.CfnRoute(this, 'CloudWanSubnetDefaultRoute', {
      routeTableId: cloudWanSubnet.routeTable.routeTableId,
      destinationCidrBlock: '0.0.0.0/0',
      vpcEndpointId: fwEndpointId,
    });

    const fwInternalRoute = new ec2.CfnRoute(this, 'FwSubnetInternalRoute', {
      routeTableId: fwSubnet.routeTable.routeTableId,
      destinationCidrBlock: '10.0.0.0/8',
      coreNetworkArn: props.coreNetworkArn,
    });
    fwInternalRoute.addDependency(attachment);

    new ec2.CfnRoute(this, 'PublicSubnetInternalRoute', {
      routeTableId: publicSubnet.routeTable.routeTableId,
      destinationCidrBlock: '10.0.0.0/8',
      vpcEndpointId: fwEndpointId,
    });

    this.vpc = vpc;
    this.attachment = attachment;
  }
}
