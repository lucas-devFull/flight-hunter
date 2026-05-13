import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

import type { FlightHunterClient } from '@bot/Client';

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | {
      name: string;
      toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
    };

export interface Command {
  data: CommandData;
  execute(interaction: ChatInputCommandInteraction, client: FlightHunterClient): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, client: FlightHunterClient): Promise<void>;
}
