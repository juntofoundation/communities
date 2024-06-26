import { Capacitor } from '@capacitor/core';

import {
    ActionPerformed,
    PushNotificationSchema,
    PushNotifications,
    Token,
} from '@capacitor/push-notifications';
import { Ad4mClient } from '@coasys/ad4m';
import { getAd4mClient } from '@coasys/ad4m-connect';

export async function registerNotification() {
    const client: Ad4mClient = await getAd4mClient();
    if (Capacitor.isNativePlatform()) {
        const notificationPromise = new Promise<string>(async (resolve, reject) => {
            const result = await PushNotifications.requestPermissions();
            console.log('Notification permission result:', result);
            if (result.receive === 'granted') {
                console.log('Notification permission granted');
                await PushNotifications.register();
                console.log('Push registration success');
            } else {
                console.error('Notification permission denied');
            }

            PushNotifications.addListener('registration', (token: Token) => {
                console.log('Push registration success, token: ' + token.value);
                resolve(token.value);
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                console.log('Error on registration: ' + JSON.stringify(error));
                reject(error);
            });
        });

        const result: string = await notificationPromise;

        PushNotifications.addListener(
            'pushNotificationReceived',
            (notification: PushNotificationSchema) => {
                console.log('Push received: ' + JSON.stringify(notification));
            },
        );

        PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (notification: ActionPerformed) => {
                console.log('Push action performed: ' + JSON.stringify(notification));
            },
        );

        await client.runtime.requestInstallNotification({
            appName: "Flux",
            description: "Messages with mentions",
            appUrl: window.location.origin,
            appIconPath: "https://i.ibb.co/GnqjPJP/icon.png",
            trigger: `
              agent_did(Did),
              subject_class("Message", C),
              instance(C, Base),
              property_getter(C, Base, "body", Body),
              literal_from_url(Body, JsonString, _),
              json_property(JsonString, "data", MessageContent),
              append("data-type=\\\"mention\\\" href=\\\"", Did, MentionString),
              string_includes(MessageContent, MentionString),
              remove_html_tags(MessageContent, Description),
              Title="You were mentioned".`,
            perspectiveIds: [],
            webhookUrl: "http://140.82.10.81:13000/notification",
            webhookAuth: result
        });
    } else {
        await client.runtime.requestInstallNotification({
            appName: "Flux",
            description: "Messages with mentions",
            appUrl: window.location.origin,
            appIconPath: "https://i.ibb.co/GnqjPJP/icon.png",
            trigger: `
              agent_did(Did),
              subject_class("Message", C),
              instance(C, Base),
              property_getter(C, Base, "body", Body),
              literal_from_url(Body, JsonString, _),
              json_property(JsonString, "data", MessageContent),
              append("data-type=\\\"mention\\\" href=\\\"", Did, MentionString),
              string_includes(MessageContent, MentionString),
              remove_html_tags(MessageContent, Description),
              Title="You were mentioned".`,
            perspectiveIds: [],
            webhookUrl: "http://140.82.10.81:13000/notification",
            webhookAuth: ""
        });
    }
}