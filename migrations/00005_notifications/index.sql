DROP TABLE IF EXISTS push_notification_devices, notification_types, notification_subscriptions, notification_subscription_notification_types CASCADE;

--------------------------------------------------------
-- Push notification devices: 'ANDROID', 'IOS', 'WEB' --
--------------------------------------------------------
CREATE TABLE push_notification_devices (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(255) CHECK (device_type IN ('ANDROID', 'IOS', 'WEB')) NOT NULL,
    device_uuid UUID NOT NULL UNIQUE,
    cloud_messaging_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update updated_at when device is updated to track validity of token
CREATE OR REPLACE TRIGGER update_push_notification_devices_updated_at
    BEFORE UPDATE ON push_notification_devices
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

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

-------------------------------------------
-- Safe subscriptions for a given device --
-------------------------------------------
CREATE TABLE notification_subscriptions (
    id SERIAL PRIMARY KEY,
    push_notification_device_id INT NOT NULL,
    chain_id VARCHAR(255) NOT NULL,
    safe_address VARCHAR(42) NOT NULL,
    signer_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (push_notification_device_id) REFERENCES push_notification_devices(id) ON DELETE CASCADE,
    UNIQUE(chain_id, safe_address, push_notification_device_id, signer_address)
);

-- Update updated_at when a notification subscription is updated
CREATE OR REPLACE TRIGGER update_notification_subscriptions_updated_at
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

----------------------------------------------------
-- Join table for subscription/notification types --
----------------------------------------------------
CREATE TABLE notification_subscription_notification_types (
    id SERIAL PRIMARY KEY,
    notification_subscription_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    FOREIGN KEY (notification_subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE(notification_subscription_id, notification_type_id)
);