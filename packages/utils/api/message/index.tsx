import {
  BODY,
  IMAGE,
  REPLY_TO,
  TITLE,
  URL,
} from "../../constants/communityPredicates";
import EntryModel from "../../helpers/model";
import { EntryType, Entry } from "../../types";

export interface Message extends Entry {
  body: string;
  replies: string[];
}

class MessageModel extends EntryModel {
  static type = EntryType.Message;
  static properties = {
    body: {
      predicate: BODY,
      type: String,
      resolve: true,
      languageAddress: "literal",
    },
    replies: {
      predicate: REPLY_TO,
      type: String,
      collection: true,
      resolve: false,
    },
  };

  async create(data: { body: string }): Promise<Entry> {
    return super.create(data);
  }

  async get(id: string) {
    return super.get(id) as Promise<Message>;
  }

  async getAll() {
    return super.getAll() as Promise<Message[]>;
  }
}

export default MessageModel;
