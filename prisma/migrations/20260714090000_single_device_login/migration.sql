-- Single-device login: bind each student account to one active device.
-- "activeDeviceId" holds the browser-generated device id currently allowed to
-- use the account; "deviceLastSeenAt" records the device's last activity.
-- The lock only clears on logout or an admin device reset.
ALTER TABLE "User" ADD COLUMN "activeDeviceId" TEXT;
ALTER TABLE "User" ADD COLUMN "deviceLastSeenAt" TIMESTAMP(3);
