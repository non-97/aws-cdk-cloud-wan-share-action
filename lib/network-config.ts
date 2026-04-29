export const cloudWanTagKey = {
  Segment: 'cloudwan-seg',
  Nfg: 'cloudwan-nfg',
} as const;

export const cloudWanSegment = {
  Share: 'share',
  Prod: 'prod',
  Dev: 'dev',
} as const;

export type CloudWanSegment = (typeof cloudWanSegment)[keyof typeof cloudWanSegment];

export const cloudWanNfg = {
  Security: 'security',
} as const;

export const CORE_NETWORK_CONFIG = {
  insideCidrBlocks: ['192.168.0.0/16'],
  asnRanges: ['65000-65099'],
  edgeAsn: 65001,
} as const;

export interface VpcNetworkConfig {
  readonly vpcCidr: string;
}

export const NETWORK_CONFIG = {
  inspection: { vpcCidr: '10.3.0.0/16' },
  share: { vpcCidr: '10.0.0.0/16' },
  prod: { vpcCidr: '10.1.0.0/16' },
  dev: { vpcCidr: '10.2.0.0/16' },
} as const satisfies Record<string, VpcNetworkConfig>;

export const RFC1918_CIDRS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] as const;
