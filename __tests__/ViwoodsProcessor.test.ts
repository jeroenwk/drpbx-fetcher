import { ViwoodsProcessor } from '../src/processors/ViwoodsProcessor/index';

describe('ViwoodsProcessor', () => {
  let processor: ViwoodsProcessor;

  beforeEach(() => {
    processor = new ViwoodsProcessor();
  });

  describe('metadata', () => {
    it('should have correct type identifier', () => {
      expect(processor.type).toBe('viwoods');
    });

    it('should have descriptive name', () => {
      expect(processor.name).toBe('Viwoods Files');
    });

    it('should have description', () => {
      expect(processor.description).toBe('Process viwoods files from all modules');
    });

    it('should support .note extension', () => {
      expect(processor.supportedExtensions).toContain('note');
    });
  });

  // TODO: Add tests for module-based architecture once architecture is stable
  describe('config and validation', () => {
    it('should validate its own default config', () => {
      const defaultConfig = processor.getDefaultConfig();
      const result = processor.validateConfig(defaultConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
