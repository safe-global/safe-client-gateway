DROP TABLE IF EXISTS notification_devices, notification_channels, notification_types, notification_subscriptions, notification_subscription_notification_types CASCADE;

---------------------------------------------------
-- Notification devices: 'ANDROID', 'IOS', 'WEB' --
---------------------------------------------------
CREATE TABLE notification_devices (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(255) CHECK (device_type IN ('ANDROID', 'IOS', 'WEB')) NOT NULL,
    device_uuid UUID NOT NULL UNIQUE,
    cloud_messaging_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update updated_at when device is updated to track validity of token
CREATE OR REPLACE TRIGGER update_notification_devices_updated_at
    BEFORE UPDATE ON notification_devices
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE notification_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Function to delete orphaned devices (called at bottom as depends on notification_subscriptions)
CREATE OR REPLACE FUNCTION delete_orphaned_devices()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM notification_devices
    WHERE id NOT IN (SELECT device_id FROM notification_subscriptions);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------
-- Notification channels, e.g. PUSH_NOTIFICATIONS --
----------------------------------------------------
INSERT INTO notification_channels (name) VALUES
    ('PUSH_NOTIFICATIONS');

--------------------------------------------
-- Notification types, e.g. INCOMING_TOKEN --
--------------------------------------------
CREATE TABLE notification_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO notification_types (name) VALUES
    ('CONFIRMATION_REQUEST'), -- PENDING_MULTISIG_TRANSACTION
    ('DELETED_MULTISIG_TRANSACTION'),
    ('EXECUTED_MULTISIG_TRANSACTION'),
    ('INCOMING_ETHER'),
    ('INCOMING_TOKEN'),
    ('MESSAGE_CONFIRMATION_REQUEST'), -- MESSAGE_CREATED
    ('MODULE_TRANSACTION');

-----------------------------------------------------------
-- Safe subscriptions for a given account-device-channel --
-----------------------------------------------------------
CREATE TABLE notification_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    device_id INT NOT NULL,
    chain_id VARCHAR(255) NOT NULL,
    safe_address VARCHAR(42) NOT NULL,
    notification_channel_id INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES notification_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
    UNIQUE(account_id, chain_id, safe_address, device_id, notification_channel_id)
);

-- Update updated_at when a notification subscription is updated
CREATE OR REPLACE TRIGGER update_notification_subscriptions_updated_at
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Join table for subscriptions/notification types
CREATE TABLE notification_subscription_notification_types (
    id SERIAL PRIMARY KEY,
    notification_subscription_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    FOREIGN KEY (notification_subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE(notification_subscription_id, notification_type_id)
);

-- Delete orphaned devices after a subscription is deleted
CREATE TRIGGER after_delete_notification_subscriptions
AFTER DELETE ON notification_subscriptions
FOR EACH ROW
EXECUTE FUNCTION delete_orphaned_devices();