DROP TABLE IF EXISTS notification_types,
    notification_subscriptions,
    notification_subscription_notification_types,
    notification_channels,
    notification_channel_configurations CASCADE;

--------------------------------------------
-- Notification types, e.g. INCOMING_TOKEN --
--------------------------------------------
CREATE TABLE notification_types(
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

----------------------------------------------------------------------
-- Chain-specific Safe notification preferences for a given account --
----------------------------------------------------------------------
CREATE TABLE notification_subscriptions(
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    chain_id VARCHAR(255) NOT NULL,
    safe_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, chain_id, safe_address)
);

-- Update updated_at when a notification subscription is updated
CREATE OR REPLACE TRIGGER update_notification_subscriptions_updated_at
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Join table for subscriptions/notification types
CREATE TABLE notification_subscription_notification_types(
    id SERIAL PRIMARY KEY,
    subscription_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE (subscription_id, notification_type_id)
);

---------------------------------------------------
-- Notification channels, e.g. PUSH_NOTIFICATIONS --
---------------------------------------------------
CREATE TABLE notification_channels(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Add PUSH_NOTIFICATIONS as a notification channel
INSERT INTO notification_channels (name) VALUES
    ('PUSH_NOTIFICATIONS');

----------------------------------------------------------------
-- Configuration for a given notification subscription/channel --
----------------------------------------------------------------
CREATE TABLE notification_channel_configurations(
    id SERIAL PRIMARY KEY,
    notification_subscription_id INT NOT NULL,
    notification_channel_id INT NOT NULL,
    cloud_messaging_token VARCHAR(255) NOT NULL,
    device_type VARCHAR(255) CHECK (device_type IN ('ANDROID', 'IOS', 'WEB')) NOT NULL,
    device_uuid UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (notification_subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
    UNIQUE (notification_subscription_id, notification_channel_id, device_uuid)
);

-- Update updated_at when a notification channel is updated
CREATE OR REPLACE TRIGGER update_notification_channel_configurations_updated_at
    BEFORE UPDATE ON notification_channel_configurations
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
