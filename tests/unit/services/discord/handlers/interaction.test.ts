/**
 * Interaction Handler Tests
 * Tests for Discord interaction routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const { mockHandleButton, mockHandleSelectMenu, mockHandleModal, mockHandleAutocomplete } = vi.hoisted(() => ({
  mockHandleButton: vi.fn(),
  mockHandleSelectMenu: vi.fn(),
  mockHandleModal: vi.fn(),
  mockHandleAutocomplete: vi.fn(),
}));

// Mock the sub-handlers
vi.mock('../../../../../src/services/discord/handlers/button.js', () => ({
  handleButton: mockHandleButton,
}));

vi.mock('../../../../../src/services/discord/handlers/select-menu.js', () => ({
  handleSelectMenu: mockHandleSelectMenu,
}));

vi.mock('../../../../../src/services/discord/handlers/modal.js', () => ({
  handleModal: mockHandleModal,
}));

vi.mock('../../../../../src/services/discord/handlers/autocomplete.js', () => ({
  handleAutocomplete: mockHandleAutocomplete,
}));

// Import after mocks
import { handleInteraction } from '../../../../../src/services/discord/handlers/interaction.js';

describe('handleInteraction', () => {
  let mockBot: any;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = vi.fn();
    mockBot = {
      commandRegistry: {
        getSlashHandler: vi.fn().mockReturnValue(mockHandler),
      },
    };
  });

  describe('interaction routing', () => {
    it('should route chat input commands to handleSlashCommand', async () => {
      const mockInteraction = {
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
        commandName: 'roll',
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockBot.commandRegistry.getSlashHandler).toHaveBeenCalledWith('roll');
      expect(mockHandler).toHaveBeenCalledWith(mockInteraction, mockBot);
    });

    it('should route button interactions to handleButton', async () => {
      const mockInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockHandleButton).toHaveBeenCalledWith(mockInteraction, mockBot);
    });

    it('should route select menu interactions to handleSelectMenu', async () => {
      const mockInteraction = {
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => true,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockHandleSelectMenu).toHaveBeenCalledWith(mockInteraction, mockBot);
    });

    it('should route modal submissions to handleModal', async () => {
      const mockInteraction = {
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => true,
        isAutocomplete: () => false,
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockHandleModal).toHaveBeenCalledWith(mockInteraction, mockBot);
    });

    it('should route autocomplete interactions to handleAutocomplete', async () => {
      const mockInteraction = {
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => true,
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockHandleAutocomplete).toHaveBeenCalledWith(mockInteraction, mockBot);
    });

    it('should not call any handler for unknown interaction types', async () => {
      const mockInteraction = {
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
      };

      await handleInteraction(mockInteraction as any, mockBot);

      expect(mockBot.commandRegistry.getSlashHandler).not.toHaveBeenCalled();
      expect(mockHandleButton).not.toHaveBeenCalled();
      expect(mockHandleSelectMenu).not.toHaveBeenCalled();
      expect(mockHandleModal).not.toHaveBeenCalled();
      expect(mockHandleAutocomplete).not.toHaveBeenCalled();
    });
  });

  describe('slash command handling', () => {
    let mockSlashInteraction: any;

    beforeEach(() => {
      mockSlashInteraction = {
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
        commandName: 'roll',
        deferred: false,
        replied: false,
        reply: vi.fn(),
        editReply: vi.fn(),
      };
    });

    it('should execute command handler when found', async () => {
      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockBot.commandRegistry.getSlashHandler).toHaveBeenCalledWith('roll');
      expect(mockHandler).toHaveBeenCalledWith(mockSlashInteraction, mockBot);
    });

    it('should reply with error when no handler found', async () => {
      mockBot.commandRegistry.getSlashHandler.mockReturnValue(undefined);

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockSlashInteraction.reply).toHaveBeenCalledWith({
        content: '❌ This command is not implemented yet.',
        ephemeral: true,
      });
    });

    it('should reply with error when handler throws (not deferred)', async () => {
      mockHandler.mockRejectedValue(new Error('Test error'));

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockSlashInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Error: Test error',
        ephemeral: true,
      });
    });

    it('should editReply with error when handler throws (deferred)', async () => {
      mockSlashInteraction.deferred = true;
      mockHandler.mockRejectedValue(new Error('Test error'));

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockSlashInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Error: Test error',
      });
      expect(mockSlashInteraction.reply).not.toHaveBeenCalled();
    });

    it('should editReply with error when handler throws (replied)', async () => {
      mockSlashInteraction.replied = true;
      mockHandler.mockRejectedValue(new Error('Test error'));

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockSlashInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Error: Test error',
      });
      expect(mockSlashInteraction.reply).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockHandler.mockRejectedValue('string error');

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockSlashInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Error: An error occurred',
        ephemeral: true,
      });
    });

    it('should use correct command name from interaction', async () => {
      mockSlashInteraction.commandName = 'help';

      await handleInteraction(mockSlashInteraction, mockBot);

      expect(mockBot.commandRegistry.getSlashHandler).toHaveBeenCalledWith('help');
    });
  });
});
