import NotionClient from "./lib/notion/client";
import DiscordClient from "./lib/discord/client";
import NotionDatabase from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropTitleString,
  NotionDatabasePropRichTextMentionList,
  NotionDatabasePropSelect,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import App from "./app";
import RemindNotificationApp, {
  RemindNotificationTasksDatabase,
} from "./app/remindNotification";
import MembersManager, { MembersDatabase } from "./membersManager";

class AppConfigListDatabase extends NotionDatabase {
  props = {
    appName: new NotionDatabasePropTitleString("appName"),
    appCode: new NotionDatabasePropSelect("appCode"),
    appConfigDatabaseLinks: new NotionDatabasePropRichTextMentionList(
      "appConfigDatabaseLinks"
    ),
  };
}

export default class Project {
  name: string;
  discordGuildId: string;

  notionClient: NotionClient;
  discordClient: DiscordClient;

  membersManager: MembersManager;
  appConfigListDatabase: AppConfigListDatabase;

  apps: Array<App<any>> = [];

  constructor(init: {
    name: string;
    discordGuildId: string;
    notionClient: NotionClient;
    discordClient: DiscordClient;
    membersDatabaseId: string;
    appConfigListDatabaseId: string;
  }) {
    this.name = init.name;
    this.discordGuildId = init.discordGuildId;

    this.notionClient = init.notionClient;
    this.discordClient = init.discordClient;

    this.appConfigListDatabase = new AppConfigListDatabase({
      notionClientOwner: this,
      rawId: init.appConfigListDatabaseId,
    });
    this.membersManager = new MembersManager({
      project: this,
      membersDatabase: new MembersDatabase({
        notionClientOwner: this,
        rawId: init.membersDatabaseId,
      }),
    });
  }

  async setup() {
    await this.membersManager.setup();

    this.apps = (await this.appConfigListDatabase.list())
      .map((record) => {
        const appCode = record.props.appCode.value?.name;
        const name = record.props.appName.value;
        const appConfigDatabaseIds =
          record.props.appConfigDatabaseLinks.value.map(({ target }) => target);

        switch (appCode) {
          case "remindNotification":
            return appConfigDatabaseIds.map(
              (tasksDatabaseId, index) =>
                new RemindNotificationApp({
                  id: `${record.id}-${index}`,
                  project: this,
                  name,
                  configDatabase: new RemindNotificationTasksDatabase({
                    notionClientOwner: this,
                    rawId: tasksDatabaseId,
                  }),
                })
            );
          default:
            return [];
        }
      })
      .flatMap((v) => v);
    await Promise.all(this.apps.map(async (app) => await app.setup()));
  }

  async update() {
    await Promise.all(this.apps.map(async (app) => await app.update()));
  }
}
