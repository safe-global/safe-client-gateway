export enum DeviceType {
  Android = 'ANDROID',
  Ios = 'IOS',
  Web = 'WEB',
}

export class Device {
  uuid: string | null;
  cloudMessagingToken: string;
  buildNumber: string;
  bundle: string;
  deviceType: DeviceType;
  version: string;
  timestamp: string | null;

  constructor(
    uuid: string | null = null,
    cloudMessagingToken: string,
    buildNumber: string,
    bundle: string,
    deviceType: DeviceType,
    version: string,
    timestamp: string | null = null,
  ) {
    this.uuid = uuid;
    this.cloudMessagingToken = cloudMessagingToken;
    this.buildNumber = buildNumber;
    this.bundle = bundle;
    this.deviceType = deviceType;
    this.version = version;
    this.timestamp = timestamp;
  }
}
