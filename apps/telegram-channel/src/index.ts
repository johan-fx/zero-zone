import { Bot, type Context } from 'grammy';

import type { TelegramWebhookResult } from '@zona-cero/contracts';

export type TelegramUpdateLike = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string; first_name?: string };
  };
};

export function resolveTelegramCommand(update: TelegramUpdateLike): string | null {
  const text = update.message?.text?.trim();
  if (!text?.startsWith('/')) {
    return null;
  }

  return text.split(/\s+/)[0].toLowerCase();
}

export function handleTelegramWebhookUpdate(update: TelegramUpdateLike): TelegramWebhookResult {
  const command = resolveTelegramCommand(update);

  if (command === '/start') {
    return {
      accepted: true,
      command,
      responseText: 'Zona Cero is ready. Choose an incident to continue.',
    };
  }

  return {
    accepted: true,
    command,
    responseText: 'Zona Cero received the update. A guided flow will handle it in the matching slice.',
  };
}

export function registerZonaCeroTelegramFlows(bot: Bot<Context>): Bot<Context> {
  bot.command('start', async (ctx) => {
    await ctx.reply(handleTelegramWebhookUpdate({ message: { text: '/start' } }).responseText);
  });

  return bot;
}

export function createZonaCeroTelegramBot(token: string): Bot<Context> {
  return registerZonaCeroTelegramFlows(new Bot(token));
}
