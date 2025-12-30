import { TemplateEngine } from '../src/processors/templates/TemplateEngine';

describe('TemplateEngine', () => {
  describe('render', () => {
    it('should replace simple variables', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'World' };
      const result = TemplateEngine.render(template, variables);

      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const template = '{{greeting}} {{name}}, welcome to {{place}}!';
      const variables = {
        greeting: 'Hello',
        name: 'Alice',
        place: 'Wonderland',
      };
      const result = TemplateEngine.render(template, variables);

      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should replace with empty string for undefined variables', () => {
      const template = 'Hello {{name}}!';
      const variables = {};
      const result = TemplateEngine.render(template, variables);

      expect(result).toBe('Hello !');
    });

    it('should handle numeric variables', () => {
      const template = 'Page {{page}} of {{total}}';
      const variables = { page: 5, total: 10 };
      const result = TemplateEngine.render(template, variables);

      expect(result).toBe('Page 5 of 10');
    });

    it('should handle object variables by stringifying', () => {
      const template = 'Data: {{data}}';
      const variables = { data: { key: 'value' } };
      const result = TemplateEngine.render(template, variables);

      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
    });

    it('should format date with default format', () => {
      const template = 'Today is {{date}}';
      const testDate = new Date('2024-01-15T14:30:00Z');
      const result = TemplateEngine.render(template, {}, testDate);

      expect(result).toBe('Today is 2024-01-15');
    });

    it('should format date with custom format', () => {
      const template = 'Created on {{date:YYYY-MM-DD HH:mm}}';
      const testDate = new Date('2024-01-15T14:30:00Z');
      const result = TemplateEngine.render(template, {}, testDate);

      // Result depends on timezone, just check it contains the date
      expect(result).toContain('Created on 2024-01-15');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should format time with default format', () => {
      const template = 'Current time: {{time}}';
      const testDate = new Date('2024-01-15T14:30:00Z');
      const result = TemplateEngine.render(template, {}, testDate);

      // Result depends on timezone
      expect(result).toMatch(/Current time: \d{2}:\d{2}/);
    });

    it('should format time with custom format', () => {
      const template = 'Time: {{time:HH:mm}}';
      const testDate = new Date('2024-01-15T14:30:00Z');
      const result = TemplateEngine.render(template, {}, testDate);

      // Result depends on timezone
      expect(result).toMatch(/Time: \d{2}:\d{2}/);
    });

    it('should handle mixed template with variables and dates', () => {
      const template = '{{title}} - {{date}} at {{time}}';
      const variables = { title: 'Meeting Notes' };
      const testDate = new Date('2024-01-15T14:30:00Z');
      const result = TemplateEngine.render(template, variables, testDate);

      // Result depends on timezone
      expect(result).toContain('Meeting Notes');
      expect(result).toContain('2024-01-15');
      expect(result).toMatch(/at \d{2}:\d{2}/);
    });

    it('should handle variables with hyphens and underscores', () => {
      const template = '{{file-name}} {{user_id}}';
      const variables = { 'file-name': 'test.txt', user_id: 123 };
      const result = TemplateEngine.render(template, variables);

      expect(result).toBe('test.txt 123');
    });
  });

  describe('escapeMarkdown', () => {
    it('should escape markdown special characters', () => {
      const text = '*bold* _italic_ `code`';
      const escaped = TemplateEngine.escapeMarkdown(text);

      expect(escaped).toBe('\\*bold\\* \\_italic\\_ \\`code\\`');
    });

    it('should escape links and headings', () => {
      const text = '[link](#heading)';
      const escaped = TemplateEngine.escapeMarkdown(text);

      expect(escaped).toBe('\\[link\\]\\(\\#heading\\)');
    });

    it('should escape all special characters', () => {
      const text = '*_`[]()#+-.!';
      const escaped = TemplateEngine.escapeMarkdown(text);

      expect(escaped).toBe('\\*\\_\\`\\[\\]\\(\\)\\#\\+\\-\\.\\!');
    });

    it('should not escape normal text', () => {
      const text = 'This is normal text with 123 numbers';
      const escaped = TemplateEngine.escapeMarkdown(text);

      expect(escaped).toBe('This is normal text with 123 numbers');
    });
  });

  describe('truncate', () => {
    it('should truncate text longer than maxLength', () => {
      const text = 'This is a very long text that needs truncation';
      const truncated = TemplateEngine.truncate(text, 20);

      expect(truncated).toBe('This is a very lo...');
      expect(truncated.length).toBe(20);
    });

    it('should not truncate text shorter than maxLength', () => {
      const text = 'Short text';
      const truncated = TemplateEngine.truncate(text, 20);

      expect(truncated).toBe('Short text');
    });

    it('should handle custom suffix', () => {
      const text = 'This is a very long text';
      const truncated = TemplateEngine.truncate(text, 15, '…');

      expect(truncated).toBe('This is a very…');
      expect(truncated.length).toBe(15);
    });

    it('should handle text equal to maxLength', () => {
      const text = 'Exactly 20 chars!!!!';
      const truncated = TemplateEngine.truncate(text, 20);

      expect(truncated).toBe('Exactly 20 chars!!!!');
    });

    it('should handle empty suffix', () => {
      const text = 'This is a long text';
      const truncated = TemplateEngine.truncate(text, 10, '');

      expect(truncated).toBe('This is a ');
      expect(truncated.length).toBe(10);
    });

    it('should respect suffix length in total length', () => {
      const text = 'This is a very long text';
      const suffix = ' [...]';
      const truncated = TemplateEngine.truncate(text, 20, suffix);

      // The truncate function: maxLength - suffix.length for text, then add suffix
      // 20 - 6 = 14 chars of text, then ' [...]' = 20 total
      expect(truncated).toBe('This is a very [...]');
      expect(truncated.length).toBe(20);
    });
  });
});
