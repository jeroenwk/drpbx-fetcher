import { FileUtils } from '../src/utils/FileUtils';

describe('FileUtils', () => {
  describe('getExtension', () => {
    it('should extract file extension without dot', () => {
      expect(FileUtils.getExtension('file.txt')).toBe('txt');
      expect(FileUtils.getExtension('document.pdf')).toBe('pdf');
      expect(FileUtils.getExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(FileUtils.getExtension('README')).toBe('');
      expect(FileUtils.getExtension('Makefile')).toBe('');
    });

    it('should return empty string for filenames ending with dot', () => {
      expect(FileUtils.getExtension('file.')).toBe('');
    });

    it('should handle paths with directories', () => {
      expect(FileUtils.getExtension('path/to/file.txt')).toBe('txt');
      expect(FileUtils.getExtension('/absolute/path/document.md')).toBe('md');
    });
  });

  describe('getBasename', () => {
    it('should return filename without extension', () => {
      expect(FileUtils.getBasename('file.txt')).toBe('file');
      expect(FileUtils.getBasename('document.pdf')).toBe('document');
    });

    it('should handle files with multiple dots', () => {
      expect(FileUtils.getBasename('archive.tar.gz')).toBe('archive.tar');
    });

    it('should return full filename if no extension', () => {
      expect(FileUtils.getBasename('README')).toBe('README');
    });

    it('should handle paths', () => {
      expect(FileUtils.getBasename('path/to/file.txt')).toBe('path/to/file');
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace invalid characters with underscores', () => {
      expect(FileUtils.sanitizeFilename('file:name.txt')).toBe('file_name.txt');
      expect(FileUtils.sanitizeFilename('file<>name.txt')).toBe('file__name.txt');
      expect(FileUtils.sanitizeFilename('file|name.txt')).toBe('file_name.txt');
    });

    it('should replace forward slashes', () => {
      expect(FileUtils.sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    });

    it('should replace all invalid Windows characters', () => {
      const invalidChars = '<>:"|?*\\';
      const filename = `file${invalidChars}name.txt`;
      const sanitized = FileUtils.sanitizeFilename(filename);
      // The regex replaces each character with underscore (8 invalid chars = 8 underscores)
      expect(sanitized).toBe('file________name.txt');
    });

    it('should keep valid characters unchanged', () => {
      expect(FileUtils.sanitizeFilename('valid-file_name.txt')).toBe('valid-file_name.txt');
    });
  });

  describe('joinPath', () => {
    it('should join path segments with forward slashes', () => {
      expect(FileUtils.joinPath('path', 'to', 'file.txt')).toBe('path/to/file.txt');
      expect(FileUtils.joinPath('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should handle empty segments', () => {
      expect(FileUtils.joinPath('path', '', 'file.txt')).toBe('path/file.txt');
      expect(FileUtils.joinPath('', 'path', 'file.txt')).toBe('path/file.txt');
    });

    it('should remove duplicate slashes', () => {
      expect(FileUtils.joinPath('path/', '/to', 'file.txt')).toBe('path/to/file.txt');
      expect(FileUtils.joinPath('path//', '//to', 'file.txt')).toBe('path/to/file.txt');
    });

    it('should handle single segment', () => {
      expect(FileUtils.joinPath('file.txt')).toBe('file.txt');
    });

    it('should filter out empty strings', () => {
      expect(FileUtils.joinPath('path', '', '', 'file.txt')).toBe('path/file.txt');
    });
  });

  describe('getParentPath', () => {
    it('should return parent directory path', () => {
      expect(FileUtils.getParentPath('path/to/file.txt')).toBe('path/to');
      expect(FileUtils.getParentPath('a/b/c')).toBe('a/b');
    });

    it('should return empty string for root-level files', () => {
      expect(FileUtils.getParentPath('file.txt')).toBe('');
    });

    it('should handle paths with leading slash', () => {
      expect(FileUtils.getParentPath('/path/to/file.txt')).toBe('/path/to');
    });

    it('should handle single directory', () => {
      expect(FileUtils.getParentPath('path/file.txt')).toBe('path');
    });
  });

  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(FileUtils.slugify('Hello World')).toBe('hello-world');
      expect(FileUtils.slugify('Test Title')).toBe('test-title');
    });

    it('should replace non-alphanumeric characters with hyphens', () => {
      expect(FileUtils.slugify('Hello, World!')).toBe('hello-world');
      expect(FileUtils.slugify('Test@Title#123')).toBe('test-title-123');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(FileUtils.slugify('  Hello World  ')).toBe('hello-world');
      expect(FileUtils.slugify('!!!Test!!!')).toBe('test');
    });

    it('should collapse multiple hyphens into one', () => {
      expect(FileUtils.slugify('Hello   World')).toBe('hello-world');
      expect(FileUtils.slugify('Test---Title')).toBe('test-title');
    });

    it('should handle numbers', () => {
      expect(FileUtils.slugify('Test 123')).toBe('test-123');
      expect(FileUtils.slugify('Version 2.0')).toBe('version-2-0');
    });

    it('should handle empty strings', () => {
      expect(FileUtils.slugify('')).toBe('');
      expect(FileUtils.slugify('!!!')).toBe('');
    });
  });
});
