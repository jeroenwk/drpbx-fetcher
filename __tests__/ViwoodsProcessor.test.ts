import { ViwoodsProcessor } from '../src/processors/ViwoodsProcessor/index';
import { ViwoodsProcessorConfig } from '../src/processors/ViwoodsProcessor/ViwoodsTypes';

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
      expect(processor.name).toBe('Viwoods Notes');
    });

    it('should have description', () => {
      expect(processor.description).toBe('Process viwoods .note files');
    });

    it('should support .note extension', () => {
      expect(processor.supportedExtensions).toContain('note');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = processor.getDefaultConfig();

      expect(config).toBeDefined();
      expect(config.highlightsFolder).toBe('Viwoods/Highlights');
      expect(config.annotationsFolder).toBe('Viwoods/Annotations');
      expect(config.sourcesFolder).toBe('Viwoods/Library');
      expect(config.pagesFolder).toBe('Viwoods/Pages');
    });

    it('should enable all features by default', () => {
      const config = processor.getDefaultConfig();

      expect(config.includeMetadata).toBe(true);
      expect(config.includeThumbnail).toBe(true);
      expect(config.extractImages).toBe(true);
      expect(config.createIndex).toBe(true);
      expect(config.processAnnotations).toBe(true);
    });

    it('should have annotation processing defaults', () => {
      const config = processor.getDefaultConfig();

      expect(config.annotationImagesFolder).toBe('Viwoods/Annotations/resources');
      expect(config.includeSummaryInAnnotation).toBe(true);
      expect(config.createCompositeImages).toBe(true);
    });
  });

  describe('getDefaultTemplates', () => {
    it('should return template defaults', () => {
      const templates = processor.getDefaultTemplates();

      expect(templates).toBeDefined();
      expect(templates).toHaveProperty('highlight');
      expect(templates).toHaveProperty('annotation');
      expect(templates).toHaveProperty('page');
    });

    it('should return string templates', () => {
      const templates = processor.getDefaultTemplates();

      expect(typeof templates.highlight).toBe('string');
      expect(typeof templates.annotation).toBe('string');
      expect(typeof templates.page).toBe('string');
    });
  });

  describe('validateConfig', () => {
    it('should validate config with at least one folder', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: 'Highlights',
        annotationsFolder: '',
        sourcesFolder: '',
        pagesFolder: '',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate config with multiple folders', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: 'Highlights',
        annotationsFolder: 'Annotations',
        sourcesFolder: 'Sources',
        pagesFolder: 'Pages',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject config with no folders specified', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: '',
        annotationsFolder: '',
        sourcesFolder: '',
        pagesFolder: '',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('At least one output folder must be specified');
    });

    it('should accept config with only annotations folder', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: '',
        annotationsFolder: 'Annotations',
        sourcesFolder: '',
        pagesFolder: '',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should accept config with only sources folder', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: '',
        annotationsFolder: '',
        sourcesFolder: 'Sources',
        pagesFolder: '',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should accept config with only pages folder', () => {
      const config: ViwoodsProcessorConfig = {
        highlightsFolder: '',
        annotationsFolder: '',
        sourcesFolder: '',
        pagesFolder: 'Pages',
        includeMetadata: true,
        includeThumbnail: true,
        extractImages: true,
        createIndex: true,
      };

      const result = processor.validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('getConfigSchema', () => {
    it('should return configuration schema', () => {
      const schema = processor.getConfigSchema();

      expect(schema).toBeDefined();
      expect(schema.fields).toBeDefined();
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should include folder configuration fields', () => {
      const schema = processor.getConfigSchema();
      const fieldKeys = schema.fields.map(f => f.key);

      expect(fieldKeys).toContain('highlightsFolder');
      expect(fieldKeys).toContain('annotationsFolder');
      expect(fieldKeys).toContain('sourcesFolder');
      expect(fieldKeys).toContain('pagesFolder');
      expect(fieldKeys).toContain('annotationImagesFolder');
    });

    it('should include template configuration fields', () => {
      const schema = processor.getConfigSchema();
      const fieldKeys = schema.fields.map(f => f.key);

      expect(fieldKeys).toContain('highlightTemplate');
      expect(fieldKeys).toContain('annotationTemplate');
      expect(fieldKeys).toContain('pageTemplate');
    });

    it('should include boolean option fields', () => {
      const schema = processor.getConfigSchema();
      const fieldKeys = schema.fields.map(f => f.key);

      expect(fieldKeys).toContain('includeMetadata');
      expect(fieldKeys).toContain('includeThumbnail');
      expect(fieldKeys).toContain('extractImages');
      expect(fieldKeys).toContain('createIndex');
      expect(fieldKeys).toContain('processAnnotations');
      expect(fieldKeys).toContain('includeSummaryInAnnotation');
      expect(fieldKeys).toContain('createCompositeImages');
    });

    it('should have proper field types', () => {
      const schema = processor.getConfigSchema();

      const folderField = schema.fields.find(f => f.key === 'highlightsFolder');
      expect(folderField?.type).toBe('folder');

      const templateField = schema.fields.find(f => f.key === 'highlightTemplate');
      expect(templateField?.type).toBe('file');

      const booleanField = schema.fields.find(f => f.key === 'includeMetadata');
      expect(booleanField?.type).toBe('boolean');
    });

    it('should have default values for folder fields', () => {
      const schema = processor.getConfigSchema();

      const highlightsField = schema.fields.find(f => f.key === 'highlightsFolder');
      expect(highlightsField?.defaultValue).toBe('Viwoods/Highlights');

      const annotationsField = schema.fields.find(f => f.key === 'annotationsFolder');
      expect(annotationsField?.defaultValue).toBe('Viwoods/Annotations');

      const sourcesField = schema.fields.find(f => f.key === 'sourcesFolder');
      expect(sourcesField?.defaultValue).toBe('Viwoods/Library');

      const pagesField = schema.fields.find(f => f.key === 'pagesFolder');
      expect(pagesField?.defaultValue).toBe('Viwoods/Pages');
    });

    it('should have default values for boolean fields', () => {
      const schema = processor.getConfigSchema();

      const metadataField = schema.fields.find(f => f.key === 'includeMetadata');
      expect(metadataField?.defaultValue).toBe(true);

      const thumbnailField = schema.fields.find(f => f.key === 'includeThumbnail');
      expect(thumbnailField?.defaultValue).toBe(true);

      const imagesField = schema.fields.find(f => f.key === 'extractImages');
      expect(imagesField?.defaultValue).toBe(true);
    });

    it('should mark folders as not required', () => {
      const schema = processor.getConfigSchema();

      const folderFields = schema.fields.filter(f => f.type === 'folder');

      folderFields.forEach(field => {
        expect(field.required).toBe(false);
      });
    });

    it('should have descriptions for all fields', () => {
      const schema = processor.getConfigSchema();

      schema.fields.forEach(field => {
        expect(field.description).toBeDefined();
        expect(field.description?.length).toBeGreaterThan(0);
      });
    });

    it('should have labels for all fields', () => {
      const schema = processor.getConfigSchema();

      schema.fields.forEach(field => {
        expect(field.label).toBeDefined();
        expect(field.label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('config integration', () => {
    it('should have schema fields matching default config', () => {
      const schema = processor.getConfigSchema();
      const schemaKeys = schema.fields.map(f => f.key);

      // Check that all core config keys have corresponding schema fields
      // Note: Some config keys might not have schema fields (e.g., optional template paths)
      const coreConfigKeys = [
        'highlightsFolder',
        'annotationsFolder',
        'sourcesFolder',
        'pagesFolder',
        'includeMetadata',
        'includeThumbnail',
        'extractImages',
        'createIndex',
      ];

      coreConfigKeys.forEach(key => {
        expect(schemaKeys).toContain(key);
      });
    });

    it('should validate its own default config', () => {
      const defaultConfig = processor.getDefaultConfig();
      const result = processor.validateConfig(defaultConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
