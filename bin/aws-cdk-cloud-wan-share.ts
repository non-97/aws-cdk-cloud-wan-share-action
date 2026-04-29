#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AwsCdkCloudWanShareStack } from '../lib/aws-cdk-cloud-wan-share-stack';

const app = new cdk.App();
new AwsCdkCloudWanShareStack(app, 'AwsCdkCloudWanShareStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-northeast-1',
  },
});
