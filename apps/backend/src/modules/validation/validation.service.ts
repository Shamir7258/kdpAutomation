import { runValidation, type ValidationContext } from '@kdp/kdp-validator';
import type { ValidationReportDto } from '@kdp/shared';
import { projectService } from '../projects/project.service.js';
import { requireBookType } from '../book-types/book-type.registry.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { metadataService } from '../metadata/metadata.service.js';
import { SectionModel } from '../outline/section.model.js';
import { interiorService } from '../interior/interior.service.js';
import { coverService } from '../cover/cover.service.js';

/**
 * Synchronous, stateless — always re-runs every rule against the project's *current* state (no
 * BullMQ job, no stored report; a preflight check is cheap and must never show stale results).
 * Same "fast enough to be a plain request" reasoning as book idea generation (ARCHITECTURE.md §5).
 */
export const validationService = {
  async run(userId: string, projectId: string): Promise<ValidationReportDto> {
    const project = await projectService.getById(userId, projectId);
    const bookType = requireBookType(project.bookType as Parameters<typeof requireBookType>[0]);

    const spec = await bookSpecificationService.getByProject(userId, projectId).catch(() => undefined);
    const metadata = await metadataService.getByProject(userId, projectId).catch(() => undefined);
    const sections = await SectionModel.find({ projectId, userId }, { currentVersion: 1 });
    const interiors = await interiorService.list(userId, projectId);
    const covers = await coverService.list(userId, projectId);

    const context: ValidationContext = {
      bookType: { supportsOutline: bookType.supportsOutline },
      specification: spec ? { trimSizeId: spec.trimSizeId, estimatedPageCount: spec.estimatedPageCount } : null,
      outline: {
        totalSections: sections.length,
        sectionsWithContent: sections.filter((s) => s.currentVersion > 0).length,
      },
      metadata: metadata
        ? {
            title: metadata.title,
            description: metadata.description,
            keywords: metadata.keywords,
            categories: metadata.categories,
            authorName: metadata.authorName,
          }
        : null,
      interiors: interiors.map((i) => ({ format: i.format, trimSizeId: i.trimSizeId, pageCount: i.pageCount })),
      // Both services already return newest-first, matching ValidationContext.covers' documented contract.
      covers: covers.map((c) => ({ paperType: c.paperType, pageCount: c.pageCount })),
    };

    const findings = runValidation(context);
    return {
      findings,
      readyToPublish: !findings.some((f) => f.severity === 'error'),
      checkedAt: new Date().toISOString(),
    };
  },
};
