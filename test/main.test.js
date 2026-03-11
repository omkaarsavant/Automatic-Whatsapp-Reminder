const { WhatsAppReminderSystem } = require('../src/index');

jest.mock('../src/index');

describe('Main Application', () => {
  it('should start when run as main module', () => {
    // Mock the main module check
    jest.isolateModules(() => {
      const originalModule = process.mainModule;
      const originalRequireMain = require.main;

      // Mock require.main
      require.main = {
        filename: 'test.js',
        id: 'test.js'
      };

      // Mock process.mainModule
      process.mainModule = require.main;

      // Mock the system
      const mockSystem = {
        start: jest.fn()
      };
      jest.mock('../src/index', () => ({
        WhatsAppReminderSystem: jest.fn(() => mockSystem)
      }));

      // Simulate the main module behavior
      const mainModuleCode = require('../src/index');

      // Verify the system was created and started
      expect(mainModuleCode.WhatsAppReminderSystem).toHaveBeenCalled();
      expect(mockSystem.start).toHaveBeenCalled();

      // Restore mocks
      require.main = originalRequireMain;
      process.mainModule = originalModule;
    });
  });
});