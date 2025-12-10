/**
 * Help Command Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config module before imports
vi.mock('../../../src/config.js', () => ({
  isAdmin: vi.fn(),
}));

// Import after mocking
import { isAdmin } from '../../../src/config.js';
import { helpCommands, helpHandler } from '../../../src/services/discord/commands/slash/help.js';

// Type the mock
const mockIsAdmin = isAdmin as ReturnType<typeof vi.fn>;

describe('Help Command', () => {
  describe('helpCommands', () => {
    it('should define the help command', () => {
      expect(helpCommands).toHaveLength(1);
      expect(helpCommands[0].name).toBe('help');
    });

    it('should have a description', () => {
      expect(helpCommands[0].description).toBe('Show available FumbleBot commands');
    });

    it('should allow DMs', () => {
      const json = helpCommands[0].toJSON();
      expect(json.dm_permission).toBe(true);
    });

    it('should have command option for specific help', () => {
      const json = helpCommands[0].toJSON();
      expect(json.options).toHaveLength(1);
      expect(json.options![0].name).toBe('command');
    });
  });

  describe('helpHandler', () => {
    let mockInteraction: any;
    let mockBot: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockInteraction = {
        user: { id: 'user-123' },
        options: {
          getString: vi.fn(),
        },
        reply: vi.fn(),
      };

      mockBot = {};
    });

    describe('for regular users', () => {
      beforeEach(() => {
        mockIsAdmin.mockReturnValue(false);
      });

      it('should show public commands only', async () => {
        mockInteraction.options.getString.mockReturnValue(null);

        await helpHandler(mockInteraction, mockBot);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  title: 'FumbleBot Commands',
                }),
              }),
            ]),
            ephemeral: true,
          })
        );
      });

      it('should not show admin commands section', async () => {
        mockInteraction.options.getString.mockReturnValue(null);

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const embed = reply.embeds[0];
        const fields = embed.data.fields;

        // Should not have "Admin Commands" field
        const adminField = fields.find((f: any) => f.name === 'Admin Commands');
        expect(adminField).toBeUndefined();
      });

      it('should show footer indicating limited access', async () => {
        mockInteraction.options.getString.mockReturnValue(null);

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const embed = reply.embeds[0];

        expect(embed.data.footer.text).toBe('Some commands require admin access');
      });

      it('should deny access to admin-only command details', async () => {
        mockInteraction.options.getString.mockReturnValue('voice');

        await helpHandler(mockInteraction, mockBot);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('admin access'),
            ephemeral: true,
          })
        );
      });

      it('should show public command details', async () => {
        mockInteraction.options.getString.mockReturnValue('roll');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        expect(reply.embeds[0].data.title).toBe('/roll');
      });
    });

    describe('for admin users', () => {
      beforeEach(() => {
        mockIsAdmin.mockReturnValue(true);
      });

      it('should show all commands including admin section', async () => {
        mockInteraction.options.getString.mockReturnValue(null);

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const embed = reply.embeds[0];
        const fields = embed.data.fields;

        // Should have "Admin Commands" field
        const adminField = fields.find((f: any) => f.name === 'Admin Commands');
        expect(adminField).toBeDefined();
      });

      it('should show footer indicating admin access', async () => {
        mockInteraction.options.getString.mockReturnValue(null);

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const embed = reply.embeds[0];

        expect(embed.data.footer.text).toBe('You have admin access to all commands');
      });

      it('should show admin command details', async () => {
        mockInteraction.options.getString.mockReturnValue('voice');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        expect(reply.embeds[0].data.title).toBe('/voice');
      });

      it('should show admin-only footer for admin commands', async () => {
        mockInteraction.options.getString.mockReturnValue('voice');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        expect(reply.embeds[0].data.footer.text).toBe('Admin-only command');
      });
    });

    describe('specific command help', () => {
      beforeEach(() => {
        mockIsAdmin.mockReturnValue(true);
      });

      it('should handle unknown commands', async () => {
        mockInteraction.options.getString.mockReturnValue('unknown');

        await helpHandler(mockInteraction, mockBot);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('Unknown command'),
            ephemeral: true,
          })
        );
      });

      it('should show usage for roll command', async () => {
        mockInteraction.options.getString.mockReturnValue('roll');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const fields = reply.embeds[0].data.fields;
        const usageField = fields.find((f: any) => f.name === 'Usage');

        expect(usageField).toBeDefined();
        expect(usageField.value).toContain('/roll');
      });

      it('should show subcommands for adventure', async () => {
        mockInteraction.options.getString.mockReturnValue('adventure');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const fields = reply.embeds[0].data.fields;
        const subcommandsField = fields.find((f: any) => f.name === 'Subcommands');

        expect(subcommandsField).toBeDefined();
        expect(subcommandsField.value).toContain('create');
        expect(subcommandsField.value).toContain('join');
      });

      it('should show additional details for roll', async () => {
        mockInteraction.options.getString.mockReturnValue('roll');

        await helpHandler(mockInteraction, mockBot);

        const reply = mockInteraction.reply.mock.calls[0][0];
        const fields = reply.embeds[0].data.fields;
        const detailsField = fields.find((f: any) => f.name === 'Details');

        expect(detailsField).toBeDefined();
        expect(detailsField.value).toContain('Dice Notation');
      });
    });
  });
});
