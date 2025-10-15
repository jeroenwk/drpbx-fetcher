import { ProcessorRegistry } from '../src/processors/ProcessorRegistry';
import { FileProcessor } from '../src/processors/types';
import { FileTypeMapping } from '../src/models/Settings';

// Mock processor for testing
const createMockProcessor = (type: string, name: string): FileProcessor => ({
  type,
  name,
  description: `${name} processor`,
  supportedExtensions: [type],
  getDefaultConfig: () => ({}),
  getDefaultTemplates: () => ({}),
  getConfigSchema: () => ({ fields: [] }),
  process: jest.fn(),
  validateConfig: jest.fn(),
});

describe('ProcessorRegistry', () => {
  let registry: ProcessorRegistry;

  beforeEach(() => {
    // Clear registry before each test
    registry = ProcessorRegistry.getInstance();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ProcessorRegistry.getInstance();
      const instance2 = ProcessorRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register a processor', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      expect(registry.has('test')).toBe(true);
      expect(registry.getByType('test')).toBe(processor);
    });

    it('should register multiple processors', () => {
      const processor1 = createMockProcessor('test1', 'Test 1');
      const processor2 = createMockProcessor('test2', 'Test 2');

      registry.register(processor1);
      registry.register(processor2);

      expect(registry.has('test1')).toBe(true);
      expect(registry.has('test2')).toBe(true);
      expect(registry.listAll()).toHaveLength(2);
    });

    it('should overwrite existing processor with same type', () => {
      const processor1 = createMockProcessor('test', 'Test 1');
      const processor2 = createMockProcessor('test', 'Test 2');

      registry.register(processor1);
      registry.register(processor2);

      expect(registry.getByType('test')).toBe(processor2);
      expect(registry.listAll()).toHaveLength(1);
    });
  });

  describe('getByType', () => {
    it('should return processor by type', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      const result = registry.getByType('test');
      expect(result).toBe(processor);
    });

    it('should return null for unknown type', () => {
      const result = registry.getByType('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getByExtension', () => {
    it('should return processor for mapped extension', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      const mappings: FileTypeMapping[] = [
        {
          id: '1',
          extension: 'note',
          processorType: 'test',
          enabled: true,
          config: {},
        },
      ];

      const result = registry.getByExtension('note', mappings);
      expect(result).toBe(processor);
    });

    it('should return null for disabled mapping', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      const mappings: FileTypeMapping[] = [
        {
          id: '1',
          extension: 'note',
          processorType: 'test',
          enabled: false,
          config: {},
        },
      ];

      const result = registry.getByExtension('note', mappings);
      expect(result).toBeNull();
    });

    it('should return null for unmapped extension', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      const mappings: FileTypeMapping[] = [];

      const result = registry.getByExtension('unknown', mappings);
      expect(result).toBeNull();
    });

    it('should be case-insensitive for extensions', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      const mappings: FileTypeMapping[] = [
        {
          id: '1',
          extension: 'note',
          processorType: 'test',
          enabled: true,
          config: {},
        },
      ];

      expect(registry.getByExtension('NOTE', mappings)).toBe(processor);
      expect(registry.getByExtension('Note', mappings)).toBe(processor);
      expect(registry.getByExtension('note', mappings)).toBe(processor);
    });
  });

  describe('listAll', () => {
    it('should return empty array when no processors registered', () => {
      expect(registry.listAll()).toEqual([]);
    });

    it('should return all registered processors', () => {
      const processor1 = createMockProcessor('test1', 'Test 1');
      const processor2 = createMockProcessor('test2', 'Test 2');
      const processor3 = createMockProcessor('test3', 'Test 3');

      registry.register(processor1);
      registry.register(processor2);
      registry.register(processor3);

      const all = registry.listAll();
      expect(all).toHaveLength(3);
      expect(all).toContain(processor1);
      expect(all).toContain(processor2);
      expect(all).toContain(processor3);
    });
  });

  describe('has', () => {
    it('should return true for registered processor', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered processor', () => {
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove processor', () => {
      const processor = createMockProcessor('test', 'Test Processor');
      registry.register(processor);

      expect(registry.has('test')).toBe(true);

      registry.unregister('test');

      expect(registry.has('test')).toBe(false);
      expect(registry.getByType('test')).toBeNull();
    });

    it('should not throw when unregistering non-existent processor', () => {
      expect(() => registry.unregister('unknown')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all processors', () => {
      const processor1 = createMockProcessor('test1', 'Test 1');
      const processor2 = createMockProcessor('test2', 'Test 2');

      registry.register(processor1);
      registry.register(processor2);

      expect(registry.listAll()).toHaveLength(2);

      registry.clear();

      expect(registry.listAll()).toHaveLength(0);
      expect(registry.has('test1')).toBe(false);
      expect(registry.has('test2')).toBe(false);
    });
  });
});
