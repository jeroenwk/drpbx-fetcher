# Product Requirements Document: Obsidian Dropbox Fetcher

**Version:** 1.0
**Date:** October 2025
**Status:** Retrospective Analysis & Future Vision

---

## Executive Summary

**Product Name:** Dropbox Fetcher for Obsidian

**Vision:** Enable seamless, intelligent synchronization of files from Dropbox to Obsidian vaults with extensible processing capabilities for different file types.

**Primary Use Case:** Automatically fetch and process files from Dropbox folders into an Obsidian vault, with special support for transforming proprietary file formats (like Viwoods .note files) into markdown and usable resources.

**Target Users:**
- Note-takers who use external apps that sync to Dropbox
- Viwoods app users wanting their notes in Obsidian
- Users managing large file collections in Dropbox
- Knowledge workers consolidating multiple sources into Obsidian

---

## Product Goals

### Primary Goals
1. **Reliable Sync** - Automatically sync configured Dropbox folders to vault
2. **Cross-Platform** - Work seamlessly on Desktop, iOS, and Android
3. **Intelligent Processing** - Transform file types into markdown and resources
4. **User Control** - Give users full control over what syncs and how
5. **Performance** - Handle large files and folders efficiently

### Success Metrics
- Sync reliability: >99% success rate
- User satisfaction: Ability to process complex file types (Viwoods)
- Performance: Handle 100+ files without issues
- Cross-platform: Same experience on all platforms
- User control: 100% configurability of sync behavior

---

## User Stories

### Core Sync Functionality

**US-001: As a user, I want to authenticate with Dropbox securely**
- Given I have a Dropbox account
- When I enter my Client ID and click Authenticate
- Then I should complete OAuth flow and gain access to my files
- Acceptance: Works on Desktop, iOS, and Android

**US-002: As a user, I want to configure folder mappings**
- Given I'm authenticated with Dropbox
- When I add a folder mapping (remote → local)
- Then files from remote folder should sync to local vault path
- Acceptance: Support multiple mappings, validate paths

**US-003: As a user, I want automatic sync on startup**
- Given I have configured folder mappings
- When Obsidian starts
- Then files should automatically sync after a delay
- Acceptance: Configurable delay, can disable auto-sync

**US-004: As a user, I want manual sync control**
- Given I have configured mappings
- When I click the ribbon icon or run command
- Then sync should start immediately
- Acceptance: Visual feedback, progress indication

**US-005: As a user, I want to skip unchanged files**
- Given a file already synced
- When sync runs and file size hasn't changed
- Then file should be skipped to save time
- Acceptance: Detect changes by size, preserve user edits

### File Processing

**US-006: As a user, I want to process Viwoods notes**
- Given I have Viwoods .note files in Dropbox
- When sync runs
- Then .note files should be extracted to markdown + resources
- Acceptance: Support all 6 Viwoods modules

**US-007: As a user, I want custom templates**
- Given I have specific markdown output needs
- When I configure custom templates
- Then processed files should use my templates
- Acceptance: Support Obsidian-style template syntax

**US-008: As a user, I want to configure which files to process**
- Given I don't need all file types
- When I disable certain processors in settings
- Then those files should be skipped
- Acceptance: Per-extension configuration, module enable/disable

**US-009: As a user, I want to preserve my edits**
- Given I've edited a processed markdown file
- When the source updates and re-syncs
- Then my edits should be preserved
- Acceptance: Smart merging, user content protection

### Advanced Features

**US-010: As a user, I want chunked downloads for large files**
- Given I have large files (>10 MB)
- When sync runs
- Then files should download in chunks to avoid crashes
- Acceptance: Configurable chunk size, progress indication

**US-011: As a user, I want mobile file size limits**
- Given I'm on a mobile device
- When sync encounters large files
- Then files over limit should be skipped
- Acceptance: Configurable limit, informative messages

**US-012: As a user, I want to see sync progress**
- Given sync is running
- When I look at status bar
- Then I should see progress (X/Y files)
- Acceptance: Non-intrusive, clear messaging

**US-013: As a user, I want to reset processed file tracking**
- Given I want to re-process deleted files
- When I click "Clear tracking" in settings
- Then all files should process again on next sync
- Acceptance: Confirmation dialog, clear explanation

---

## Functional Requirements

### Core Sync Engine

**FR-001: Dropbox Authentication**
- Support OAuth 2.0 with PKCE
- Store access and refresh tokens securely
- Automatic token refresh
- Platform-specific flows (Desktop: localhost, Mobile: custom URI)

**FR-002: Folder Mapping Configuration**
- Allow multiple folder mappings
- Validate remote paths (must start with `/`)
- Validate local paths (relative to vault root)
- Support nested folders and subdirectories

**FR-003: File Synchronization**
- Recursive folder traversal
- Pagination support for large folders
- Skip unchanged files (size comparison)
- Create folder structure automatically
- Atomic file operations

**FR-004: Download Strategy**
- Regular download for small files (<10 MB)
- Chunked download for large files (configurable threshold)
- HTTP Range request support
- Configurable chunk size (default 2 MB)
- Progress tracking per chunk

**FR-005: Platform Support**
- Desktop: Windows, macOS, Linux
- Mobile: iOS and Android
- Platform detection
- Platform-specific workarounds (e.g., Android Content-Type headers)

### File Processing System

**FR-006: Processor Architecture**
- Plugin-based processor system
- Processor registration and discovery
- Extension-based routing
- Path-based routing (via canHandleFile hook)
- Processor enable/disable per file type

**FR-007: Processor Interface**
- `process()` - Main processing method
- `validateConfig()` - Configuration validation
- `getDefaultConfig()` - Default settings
- `getDefaultTemplates()` - Default templates
- `getConfigSchema()` - UI generation
- `shouldSkipFile()` - Early filtering (optional)
- `canHandleFile()` - Path-based routing (optional)

**FR-008: Viwoods Processor**
- Support 6 modules: Paper, Learning, Meeting, Daily, Picking, Memo
- Module-specific configurations
- Template system per module
- Handwriting extraction
- Image composition (JPG background + PNG overlay)
- EPUB extraction
- Annotation processing
- Cross-referencing between modules

**FR-009: Default Processor**
- Copy files directly to vault
- Support images, PDFs, generic files
- No transformation

**FR-010: Template System**
- Obsidian-style variable syntax `{{variable}}`
- Date formatting support
- Conditional logic (planned)
- Custom template paths
- Template caching

### Data Management

**FR-011: Settings Storage**
- Plugin settings in data.json
- OAuth tokens
- Folder mappings
- File type mappings
- Processor configurations
- Processed file tracking (Dropbox file ID → size)

**FR-012: Metadata Storage**
- Viwoods note metadata in vault (YAML frontmatter)
- Track note IDs (stable across renames)
- Track Dropbox file IDs
- Track page information
- Track image paths

**FR-013: Processed File Tracking**
- Track by Dropbox file ID + size
- Skip re-processing unchanged files
- Allow manual reset via settings
- Preserve user edits to output files

**FR-014: Rename Detection**
- Use Viwoods internal note ID
- Detect when notes renamed in Dropbox
- Update markdown files automatically
- Rename associated images
- Clean up old images

### User Interface

**FR-015: Settings UI**
- General settings section
- Dropbox authentication section
- Folder mappings management (add/delete)
- File type mappings configuration
- Processor-specific settings
- Skipped extensions list
- Mobile file size limit
- Chunked download settings
- Logging configuration

**FR-016: Status Feedback**
- Status bar item for progress
- Progress indicator (X/Y files)
- Completion summary
- Error messages (non-intrusive)
- Automatic timeout for messages

**FR-017: Commands & Controls**
- Ribbon icon for manual sync
- Command palette command
- Settings page sync button
- OAuth authentication button

### Performance & Reliability

**FR-018: Error Handling**
- Network error recovery
- Partial sync completion
- Error logging
- User-friendly error messages
- Continue on individual file errors

**FR-019: Resource Management**
- Memory-efficient ZIP extraction (streaming)
- Chunked downloads for large files
- Temp file cleanup
- Image cache busting
- Mobile resource limits

**FR-020: Logging & Debugging**
- Console logging (default)
- Network stream logging (optional)
- Structured logging (StreamLogger)
- Log levels: info, warn, error
- Platform and version tracking

---

## Non-Functional Requirements

### Performance
- **NFR-001:** Sync 100 files in <60 seconds (average network)
- **NFR-002:** Handle files up to 100 MB on desktop
- **NFR-003:** Handle files up to 10 MB on mobile (configurable)
- **NFR-004:** Use <100 MB memory during sync
- **NFR-005:** Chunked download memory overhead <5 MB

### Reliability
- **NFR-006:** 99%+ sync success rate
- **NFR-007:** Atomic file operations (no partial writes)
- **NFR-008:** Graceful degradation on network issues
- **NFR-009:** Preserve user edits 100% of time
- **NFR-010:** No data loss on errors

### Security
- **NFR-011:** OAuth 2.0 with PKCE
- **NFR-012:** Secure token storage
- **NFR-013:** No third-party data transmission
- **NFR-014:** HTTPS only for Dropbox API

### Usability
- **NFR-015:** Settings understandable by non-technical users
- **NFR-016:** Clear error messages
- **NFR-017:** Non-intrusive notifications
- **NFR-018:** Consistent UI across platforms

### Maintainability
- **NFR-019:** TypeScript type safety (no `any` types)
- **NFR-020:** Test coverage >70% for core logic
- **NFR-021:** Modular processor architecture
- **NFR-022:** Clear separation of concerns
- **NFR-023:** Comprehensive documentation

### Compatibility
- **NFR-024:** Obsidian API compatibility (current version)
- **NFR-025:** Dropbox API v2 compatibility
- **NFR-026:** Cross-platform (Desktop + Mobile)
- **NFR-027:** Backward compatible settings migration

---

## Architecture Principles

### 1. Separation of Concerns
- Sync logic separate from processing logic
- Dropbox API interactions abstracted
- UI separate from business logic

### 2. Open/Closed Principle
- Open for extension (new processors)
- Closed for modification (core sync engine)

### 3. Dependency Inversion
- Depend on interfaces, not implementations
- Processors don't know about Dropbox
- Sync engine doesn't know about specific processors

### 4. Single Responsibility
- Each class has one reason to change
- Processors only process files
- Sync engine only orchestrates sync

### 5. Interface Segregation
- Processors implement minimal interface
- Optional hooks for advanced features
- No forced dependencies

---

## Technical Stack

### Core Technologies
- **Language:** TypeScript 4.7.4
- **Platform:** Obsidian Plugin API
- **Build:** esbuild 0.17.3
- **Testing:** Jest 30.2.0

### Key Dependencies
- **dropbox:** ^10.34.0 - Dropbox SDK
- **@zip.js/zip.js:** ^2.8.7 - Streaming ZIP extraction
- **jszip:** ^3.10.1 - ZIP processing fallback

### Development Tools
- **ESLint:** Code quality
- **TypeScript:** Type checking
- **ts-jest:** TypeScript testing
- **npm scripts:** Build automation

---

## Release Strategy

### Version Numbering
- **Major (0.x.0):** Breaking changes, major features
- **Minor (0.2.x):** New features, backwards compatible
- **Patch (0.2.164):** Bug fixes, small improvements

### Release Process
1. Run tests: `npm test`
2. Type check: `npx tsc -noEmit -skipLibCheck`
3. Lint: `npm run lint`
4. Build: `npm run build`
5. Update CHANGELOG.md and README.md
6. Commit changes
7. Create GitHub release
8. Tag version

### Quality Gates
- All tests must pass
- No TypeScript errors
- No ESLint warnings
- Documentation updated
- CHANGELOG updated

---

## Future Enhancements

### Phase 1: Near Term
- Bidirectional sync (vault → Dropbox)
- Selective file sync (filters, patterns)
- Conflict resolution UI
- Sync scheduling (hourly, daily)
- More file processors (PDF annotations, images, etc.)

### Phase 2: Medium Term
- Incremental sync (only changed files)
- Real-time sync via Dropbox webhooks
- Background sync on mobile
- Sync status dashboard
- Multi-vault support

### Phase 3: Long Term
- Plugin split (core fetcher + Viwoods extension)
- Plugin API for third-party processors
- Marketplace for processors
- Cloud sync service integration
- Advanced merge strategies

---

## Risks & Mitigations

### Technical Risks

**Risk:** Dropbox API rate limits
- **Mitigation:** Implement exponential backoff, batch operations

**Risk:** Large file crashes on mobile
- **Mitigation:** File size limits, chunked downloads, memory monitoring

**Risk:** User edits overwritten
- **Mitigation:** Smart merging, metadata tracking, file size checks

**Risk:** Cross-platform compatibility issues
- **Mitigation:** Platform detection, platform-specific code paths, extensive testing

### Business Risks

**Risk:** Viwoods API changes
- **Mitigation:** Version detection, graceful degradation, community updates

**Risk:** Obsidian API changes
- **Mitigation:** Track Obsidian updates, test with beta releases

**Risk:** Limited user base (Viwoods-specific)
- **Mitigation:** Generic sync engine usable by anyone, processor extensibility

---

## Success Criteria

### Launch Criteria
- ✅ OAuth authentication working on all platforms
- ✅ Folder mapping configuration
- ✅ Basic file sync functionality
- ✅ At least one file processor working
- ✅ Error handling and user feedback

### 1.0 Criteria
- ✅ All 6 Viwoods modules supported
- ✅ Template system working
- ✅ Rename detection
- ✅ Cross-referencing
- ✅ Comprehensive testing (115+ tests)
- ✅ Documentation complete

### Future Success
- Plugin adoption: >1000 users
- Extension ecosystem: >3 third-party processors
- Community contributions: >10 contributors
- Support requests: <5% of user base
- User satisfaction: >4.5/5 stars

---

## Appendix: Glossary

- **Processor:** Component that transforms files during sync
- **Module:** Viwoods app type (Paper, Learning, Meeting, Daily, Picking, Memo)
- **Mapping:** Configuration linking Dropbox folder to vault folder
- **Fetch/Sync:** Download files from Dropbox to vault
- **Metadata:** Tracking information about processed files
- **Template:** Markdown template for output formatting
- **Chunk:** Segment of file downloaded in chunked mode
- **PKCE:** Proof Key for Code Exchange (OAuth security)

---

**Document Control:**
- Created: October 2025
- Author: Architecture Analysis
- Status: Retrospective + Future Vision
- Next Review: When planning major version
