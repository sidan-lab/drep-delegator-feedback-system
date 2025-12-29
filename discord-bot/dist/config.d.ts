export declare const config: {
    discord: {
        token: string | undefined;
        clientId: string | undefined;
        guildId: string | undefined;
    };
    roles: {
        delegatedRoleId: string | undefined;
    };
    api: {
        baseUrl: string | undefined;
        apiKey: string | undefined;
    };
    drep: {
        id: string | undefined;
    };
    channels: {
        delegateChannelId: string | undefined;
        forumChannelId: string | undefined;
    };
    cron: {
        proposalSyncSchedule: string | undefined;
    };
    verification: {
        frontendUrl: string | undefined;
    };
    frontend: {
        baseUrl: string | undefined;
    };
};
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map