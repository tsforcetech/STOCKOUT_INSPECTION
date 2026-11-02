/**
 * Catalog taxonomy API contracts (services/catalog-listing).
 *
 * Mirrors the JSON produced/consumed by the .NET controllers under
 * services/catalog-listing/src/Emcore.CatalogListing.Api/Controllers.
 * See docs/contracts/catalog-taxonomy.md for per-endpoint details and citations.
 *
 * Serialization facts (ASP.NET Core MVC defaults, no AddJsonOptions in Program.cs):
 *  - property names are camelCase on output; input matching is case-insensitive
 *  - there are NO C# enums in these DTOs: "enum-like" values are plain strings
 *  - Guid -> string; decimal -> JSON number; DateTime -> ISO-8601 string.
 *    Timestamps read from SQL have DateTimeKind.Unspecified and are emitted WITHOUT a
 *    trailing "Z" (e.g. "2026-01-02T03:04:05.1234567"); create responses built in memory
 *    (category/attribute/brand/unit create) use DateTime.UtcNow and DO end in "Z".
 *    Treat all as UTC.
 *  - null-valued properties are written as `null` (not omitted).
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** System.Guid serialized as string ("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"). */
export type Guid = string;

/** System.DateTime serialized as ISO-8601 string (may lack "Z"; always UTC). */
export type IsoDateTime = string;

/** C# Emcore.CatalogListing.Contracts.Responses.ApiResponse<T>. Every 2xx body. */
export interface ApiResponse<T> {
  success: boolean; // always true on success responses
  data: T;
}

/**
 * C# Emcore.CatalogListing.Contracts.Responses.ErrorResponse. Every service-generated 4xx/5xx body.
 * `message` is null for Unit endpoints (AdminUnitsController / AdminCategoryUnitsController set only `error`).
 * There is NO field-level validation detail: model validation failures are always
 * { error: "INVALID_DATA", message: "Validation failed" }.
 */
export interface ErrorResponse {
  error: string;
  message: string | null;
}

/** Body shape of a bare 401/403 or unmatched route when rewritten by the API gateway (application/problem+json). */
export interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string; // e.g. "authentication_required", "forbidden_access", "unmatched_gateway_route"
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  instance: string;
}

/** Error code emitted by RequiresPlatformPermissionAttribute (HTTP 403). */
export const FORBIDDEN_ERROR = 'FORBIDDEN' as const;
/** Error code emitted by InvalidModelStateResponseFactory (HTTP 400). */
export const MODEL_VALIDATION_ERROR = 'INVALID_DATA' as const;

/** C# Emcore.CatalogListing.Api.Controllers.ExpectedVersionRequest (body of unit/condition/grade deactivate/reactivate). */
export interface ExpectedVersionRequest {
  expectedVersion: number; // int; omitted => 0
}

/** Query string of attribute/brand/category (and attribute option) deactivate/reactivate: ?expectedVersion=<int>. */
export interface ExpectedVersionQuery {
  expectedVersion: number;
}

/** Inheritance mode for category unit / condition configuration (validated in SQL procs). */
export type InheritanceMode = 'INHERIT' | 'OVERRIDE';
export const INHERITANCE_MODES = ['INHERIT', 'OVERRIDE'] as const;

// ---------------------------------------------------------------------------
// Permission codes (RequiresPlatformPermission attribute values)
// ---------------------------------------------------------------------------

export const CATALOG_TAXONOMY_PERMISSIONS = {
  attributesView: 'catalog.attributes.view',
  attributesCreate: 'catalog.attributes.create',
  attributesUpdate: 'catalog.attributes.update',
  attributesDeactivate: 'catalog.attributes.deactivate',
  attributesReactivate: 'catalog.attributes.reactivate',
  brandsView: 'catalog.brands.view',
  brandsCreate: 'catalog.brands.create',
  brandsUpdate: 'catalog.brands.update',
  brandsDeactivate: 'catalog.brands.deactivate',
  brandsReactivate: 'catalog.brands.reactivate',
  categoriesView: 'catalog.categories.view',
  categoriesCreate: 'catalog.categories.create',
  categoriesUpdate: 'catalog.categories.update',
  categoriesDeactivate: 'catalog.categories.deactivate',
  categoriesReactivate: 'catalog.categories.reactivate',
  categoryAttributesView: 'catalog.category-attributes.view',
  categoryAttributesManage: 'catalog.category-attributes.manage',
  categoryBrandsView: 'catalog.category-brands.view',
  categoryBrandsManage: 'catalog.category-brands.manage',
  categoryConditionsView: 'catalog.category-conditions.view',
  categoryConditionsManage: 'catalog.category-conditions.manage',
  categoryUnitsView: 'catalog.category-units.view',
  categoryUnitsManage: 'catalog.category-units.manage',
  conditionsView: 'catalog.conditions.view',
  conditionsCreate: 'catalog.conditions.create',
  conditionsUpdate: 'catalog.conditions.update', // also guards PUT conditions/{id}/grades
  conditionsDeactivate: 'catalog.conditions.deactivate',
  conditionsReactivate: 'catalog.conditions.reactivate',
  gradesView: 'catalog.grades.view',
  gradesCreate: 'catalog.grades.create',
  gradesUpdate: 'catalog.grades.update',
  gradesDeactivate: 'catalog.grades.deactivate',
  gradesReactivate: 'catalog.grades.reactivate',
  unitsView: 'catalog.units.view',
  unitsCreate: 'catalog.units.create',
  unitsUpdate: 'catalog.units.update',
  unitsDeactivate: 'catalog.units.deactivate',
  unitsReactivate: 'catalog.units.reactivate',
} as const;
export type CatalogTaxonomyPermission =
  (typeof CATALOG_TAXONOMY_PERMISSIONS)[keyof typeof CATALOG_TAXONOMY_PERMISSIONS];

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

/** Allowed AttributeDefinition.DataType values (AttributeService.ValidateDefinition, case-sensitive). */
export type AttributeDataType =
  | 'TEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT';
export const ATTRIBUTE_DATA_TYPES = [
  'TEXT',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'SINGLE_SELECT',
  'MULTI_SELECT',
] as const;
/** Data types that accept options (AttributeService.CreateOptionAsync). */
export const ATTRIBUTE_OPTION_DATA_TYPES = ['SINGLE_SELECT', 'MULTI_SELECT'] as const;

/** Attribute validation limits (service rules + DB column sizes; DB overflow => unhandled 500). */
export const ATTRIBUTE_LIMITS = {
  codePattern: /^[a-z0-9_]+$/, // checked BEFORE trim/lowercase; must already match
  codeMaxLength: 100, // VARCHAR(100) (DB only)
  nameMaxLength: 200, // NVARCHAR(200) (DB only)
  descriptionMaxLength: 1000, // NVARCHAR(1000) (DB only)
  regexPatternMaxLength: 500, // NVARCHAR(500) (DB only)
  decimalPrecisionMin: 0, // DECIMAL type only
  decimalPrecisionMax: 10,
  optionValueMaxLength: 200, // NVARCHAR(200) (DB only)
  optionDisplayOrderMin: 0,
  categoryAttributeDisplayOrderMin: 0,
} as const;

/** C# CreateAttributeDefinitionRequest. Constraint matrix per dataType documented in markdown. */
export interface CreateAttributeDefinitionRequest {
  code: string;
  name: string;
  description?: string | null;
  dataType: AttributeDataType;
  minLength?: number | null; // TEXT only
  maxLength?: number | null; // TEXT only
  minValue?: number | null; // INTEGER (whole) / DECIMAL only
  maxValue?: number | null; // INTEGER (whole) / DECIMAL only
  decimalPrecision?: number | null; // DECIMAL only, 0..10
  regexPattern?: string | null; // TEXT only, must compile as .NET regex
}

/** C# UpdateAttributeDefinitionRequest (code and dataType are immutable). */
export interface UpdateAttributeDefinitionRequest {
  name: string;
  description?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  decimalPrecision?: number | null;
  regexPattern?: string | null;
  expectedVersion: number;
}

/** C# AdminAttributeDefinitionResponse. */
export interface AdminAttributeDefinitionResponse {
  attributeDefinitionId: Guid;
  code: string;
  name: string;
  description: string | null;
  dataType: AttributeDataType;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  decimalPrecision: number | null;
  regexPattern: string | null;
  isActive: boolean;
  version: number;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
}

/** C# CreateAttributeOptionRequest. */
export interface CreateAttributeOptionRequest {
  value: string; // non-blank, trimmed
  displayOrder: number; // >= 0
}

/** C# UpdateAttributeOptionRequest. */
export interface UpdateAttributeOptionRequest {
  value: string;
  displayOrder: number; // >= 0
  expectedVersion: number;
}

/** C# AttributeOptionResponse. */
export interface AttributeOptionResponse {
  attributeOptionId: Guid;
  value: string;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

/** C# CategoryAttributeAssignmentRequest. */
export interface CategoryAttributeAssignmentRequest {
  attributeDefinitionId: Guid;
  isRequired: boolean;
  displayOrder: number; // >= 0
}

/** C# ReplaceCategoryAttributesRequest (PUT replaces the full DIRECT set). */
export interface ReplaceCategoryAttributesRequest {
  expectedCategoryVersion: number;
  attributes: CategoryAttributeAssignmentRequest[];
}

/** C# AdminCategoryAttributeResponse. */
export interface AdminCategoryAttributeResponse {
  categoryAttributeId: Guid;
  categoryId: Guid;
  attributeDefinitionId: Guid;
  code: string;
  name: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean; // removed assignments are soft-deleted and still returned with isActive=false
  version: number;
  isInherited: boolean;
  sourceCategoryId: Guid | null; // always populated in practice
}

/** C# AdminCategoryAttributesResultResponse. */
export interface AdminCategoryAttributesResultResponse {
  categoryId: Guid;
  categoryVersion: number;
  directAssignments: AdminCategoryAttributeResponse[];
  inheritedAssignments: AdminCategoryAttributeResponse[];
}

/** C# EffectiveCategoryAttributeResponse (public). Options contain ACTIVE options only. */
export interface EffectiveCategoryAttributeResponse {
  attributeDefinitionId: Guid;
  code: string;
  name: string;
  description: string | null;
  dataType: AttributeDataType;
  isRequired: boolean;
  displayOrder: number;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  decimalPrecision: number | null;
  regexPattern: string | null;
  options: AttributeOptionResponse[];
  isInherited: boolean;
  sourceCategoryId: Guid | null;
}

export type AttributeErrorCode =
  | 'ATTRIBUTE_NOT_FOUND' // 404
  | 'ATTRIBUTE_CODE_ALREADY_EXISTS' // 409
  | 'ATTRIBUTE_NAME_ALREADY_EXISTS' // 409
  | 'ATTRIBUTE_ALREADY_INACTIVE' // 409
  | 'ATTRIBUTE_ALREADY_ACTIVE' // 409
  | 'ATTRIBUTE_CONCURRENCY_CONFLICT' // 409
  | 'ATTRIBUTE_OPTION_NOT_FOUND' // 404
  | 'ATTRIBUTE_OPTION_ALREADY_EXISTS' // 409
  | 'ATTRIBUTE_OPTION_ALREADY_INACTIVE' // 409
  | 'ATTRIBUTE_OPTION_ALREADY_ACTIVE' // 409
  | 'ATTRIBUTE_OPTION_CONCURRENCY_CONFLICT' // 409
  | 'ATTRIBUTE_OPTIONS_NOT_ALLOWED' // 400
  | 'ATTRIBUTE_REQUIRES_ACTIVE_OPTION' // 409
  | 'INVALID_ATTRIBUTE_DATA_TYPE' // 400
  | 'INVALID_ATTRIBUTE_VALIDATION' // 400
  | 'INVALID_DATA'; // 400

export type CategoryAttributesErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'CATEGORY_INACTIVE' // 409 (GET and PUT)
  | 'CATEGORY_ATTRIBUTE_ALREADY_ASSIGNED' // 409 (already active on an ancestor)
  | 'CATEGORY_CONCURRENCY_CONFLICT' // 409
  | 'ATTRIBUTE_REQUIRES_ACTIVE_OPTION' // 409
  | 'INVALID_DATA'; // 400 (negative displayOrder, duplicate ids, unknown/inactive attribute)

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const BRAND_LIMITS = {
  codeMaxLength: 100, // NVARCHAR(100) (DB only)
  nameMaxLength: 200, // NVARCHAR(200) (DB only)
  descriptionMaxLength: 500, // NVARCHAR(500) (DB only)
} as const;

/** C# CreateBrandRequest. code/name required non-blank (trimmed; code case preserved). */
export interface CreateBrandRequest {
  code: string;
  name: string;
  description?: string | null;
}

/** C# UpdateBrandRequest (code immutable). */
export interface UpdateBrandRequest {
  name: string;
  description?: string | null;
  expectedVersion: number;
}

/** C# BrandResponse (admin). */
export interface BrandResponse {
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdAtUtc: IsoDateTime;
  createdByUserId: Guid;
  updatedAtUtc: IsoDateTime | null;
  updatedByUserId: Guid | null;
}

/** C# PublicBrandResponse. */
export interface PublicBrandResponse {
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
}

/** C# ReplaceCategoryBrandsRequest (PUT replaces the full DIRECT set). */
export interface ReplaceCategoryBrandsRequest {
  expectedCategoryVersion: number; // take from GET /admin/catalog/categories/{id} -> version
  brandIds: Guid[];
}

/** C# AdminCategoryBrandResponse. */
export interface AdminCategoryBrandResponse {
  categoryBrandId: Guid;
  categoryId: Guid;
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean; // removed assignments remain with isActive=false
  version: number;
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# EffectiveCategoryBrandResponse (public). */
export interface EffectiveCategoryBrandResponse {
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
  isInherited: boolean;
  sourceCategoryId: Guid;
}

export type BrandErrorCode =
  | 'BRAND_NOT_FOUND' // 404
  | 'BRAND_CODE_ALREADY_EXISTS' // 409
  | 'BRAND_NAME_ALREADY_EXISTS' // 409
  | 'BRAND_CONCURRENCY_CONFLICT' // 409
  | 'BRAND_ALREADY_INACTIVE' // 409
  | 'BRAND_ALREADY_ACTIVE' // 409
  | 'INVALID_DATA'; // 400

export type CategoryBrandsErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'CATEGORY_INACTIVE' // 409
  | 'CATEGORY_CONCURRENCY_CONFLICT' // 409
  | 'CATEGORY_BRAND_ALREADY_ASSIGNED' // 409
  | 'INVALID_DATA'; // 400 (unknown/inactive/duplicate brand)

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** DataAnnotations on CreateCategoryRequest/UpdateCategoryRequest + DB columns. */
export const CATEGORY_LIMITS = {
  codeMaxLength: 100, // [MaxLength(100)]
  slugMaxLength: 100, // [MaxLength(100)]
  descriptionMaxLength: 500, // [MaxLength(500)]
  nameMaxLength: 200, // [MaxLength(200)]
} as const;

/** Server-side slug normalization (CategoryService.NormalizeSlug): replicate for previews. */
export function normalizeCategorySlug(slug: string | null | undefined): string {
  if (!slug || slug.trim() === '') return '';
  let out = '';
  let lastWasDash = false;
  for (const c of slug.trim().toLowerCase()) {
    if (/[\p{L}\p{Nd}]/u.test(c)) {
      out += c;
      lastWasDash = false;
    } else if (c === ' ' || c === '_' || c === '-') {
      if (!lastWasDash) {
        out += '-';
        lastWasDash = true;
      }
    }
  }
  return out.replace(/^-+|-+$/g, '');
}

/**
 * C# CreateCategoryRequest.
 * NOTE: `description` is a non-nullable string => implicitly [Required] by MVC (Nullable enabled):
 * must be a non-blank string, else 400 INVALID_DATA. (Inferred from framework default; see markdown.)
 */
export interface CreateCategoryRequest {
  code: string; // required, <=100, trimmed, case preserved
  slug: string; // required, <=100, normalized server-side
  description: string; // <=500, effectively required non-blank
  displayOrder: number;
  parentCategoryId?: Guid | null; // null => root
  name: string; // required, <=200
  /** R3-A: listings in this exact category need a physical inspection before publish (default false). */
  requiresPhysicalInspection?: boolean | null;
}

/** C# UpdateCategoryRequest (code immutable). */
export interface UpdateCategoryRequest {
  slug: string;
  description: string;
  displayOrder: number;
  parentCategoryId?: Guid | null; // null => move to root
  name: string;
  expectedVersion: number;
  /** R3-A: omitted/null keeps the current value. */
  requiresPhysicalInspection?: boolean | null;
}

/** C# AdminCategoryResponse (flat; tree built client-side from parentCategoryId). */
export interface AdminCategoryResponse {
  categoryId: Guid;
  code: string;
  slug: string;
  description: string;
  displayOrder: number;
  parentCategoryId: Guid | null;
  parentCategoryName: string | null; // null on the POST (create) response even when a parent is set
  name: string;
  isActive: boolean;
  /** R3-A: snapshotted onto new listing versions in this exact category (not inherited by children). */
  requiresPhysicalInspection: boolean;
  version: number;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
}

/** Query params for GET /api/v1/admin/catalog/categories (no paging, no sort param). */
export interface AdminCategoryListQuery {
  search?: string; // LIKE %search% on name, code, slug
  parentCategoryId?: Guid; // direct children only; omit => all levels (cannot filter roots-only)
  isActive?: boolean; // omit => both
}

/** C# PublicCategoryTreeResponse (recursive; active categories only). */
export interface PublicCategoryTreeResponse {
  categoryId: Guid;
  slug: string;
  parentCategoryId: Guid | null;
  name: string;
  children: PublicCategoryTreeResponse[];
}

export type CategoryErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'DUPLICATE_CATEGORY_CODE' // 409
  | 'DUPLICATE_CATEGORY_SLUG' // 409
  | 'PARENT_CATEGORY_NOT_FOUND' // 400
  | 'PARENT_CATEGORY_INACTIVE' // 400
  | 'CATEGORY_PARENT_SELF_REFERENCE' // 400
  | 'CATEGORY_HIERARCHY_CYCLE' // 400
  | 'CATEGORY_HAS_ACTIVE_CHILDREN' // 409
  | 'CATEGORY_ALREADY_INACTIVE' // 409
  | 'CATEGORY_ALREADY_ACTIVE' // 409
  | 'CATEGORY_CONCURRENCY_CONFLICT' // 409
  | 'INVALID_DATA'; // 400

// ---------------------------------------------------------------------------
// Conditions & Grades
// ---------------------------------------------------------------------------

export const CONDITION_LIMITS = {
  codeMaxLength: 50, // [StringLength(50)]; lowercased + trimmed server-side
  nameMaxLength: 100, // [StringLength(100)]
  descriptionMaxLength: 500, // [StringLength(500)]
  conditionGradesMaxItems: 100, // UpdateConditionGradesRequest.Grades [MaxLength(100)]
  categoryConditionsMaxItems: 50, // UpdateCategoryConditionsRequest.Conditions [MaxLength(50)]
  inheritanceModeMaxLength: 50, // [StringLength(50)]
} as const;
export const GRADE_LIMITS = {
  codeMaxLength: 50, // lowercased + trimmed server-side
  nameMaxLength: 100,
  descriptionMaxLength: 500,
} as const;

/** C# CreateConditionRequest. */
export interface CreateConditionRequest {
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
}

/** C# UpdateConditionRequest. */
export interface UpdateConditionRequest {
  name: string;
  description?: string | null;
  displayOrder: number;
  expectedVersion: number;
}

/** C# ConditionResponse (no audit timestamps). */
export interface ConditionResponse {
  conditionId: Guid;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

/** C# ConditionGradeAssignmentRequest. */
export interface ConditionGradeAssignmentRequest {
  gradeId: Guid;
  displayOrder: number;
}

/** C# UpdateConditionGradesRequest. expectedVersion is the CONDITION version (bumped on success). */
export interface UpdateConditionGradesRequest {
  expectedVersion: number;
  grades: ConditionGradeAssignmentRequest[]; // max 100, no duplicate gradeId
}

/** C# ConditionGradeResponse. Includes removed mappings (isActive=false). */
export interface ConditionGradeResponse {
  gradeId: Guid;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number; // mapping display order
  isActive: boolean; // MAPPING active flag (not grade active flag)
}

/** C# CreateGradeRequest. */
export interface CreateGradeRequest {
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
}

/** C# UpdateGradeRequest. */
export interface UpdateGradeRequest {
  name: string;
  description?: string | null;
  displayOrder: number;
  expectedVersion: number;
}

/** C# GradeResponse. */
export interface GradeResponse {
  gradeId: Guid;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

/** C# DirectCategoryConditionRequest. */
export interface DirectCategoryConditionRequest {
  conditionId: Guid;
  displayOrder: number;
  isGradeRequired: boolean;
}

/** C# UpdateCategoryConditionsRequest (PUT replaces config + full DIRECT set). */
export interface UpdateCategoryConditionsRequest {
  expectedCategoryVersion: number;
  inheritanceMode: InheritanceMode; // trimmed + uppercased server-side
  isConditionRequired: boolean;
  conditions: DirectCategoryConditionRequest[]; // max 50, no duplicate conditionId
}

/** C# AdminCategoryConditionDto. */
export interface AdminCategoryConditionDto {
  conditionId: Guid;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isGradeRequired: boolean;
  isActive: boolean; // BUG: never selected by usp_GetAdminCategoryConditions => always false
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# AdminCategoryConditionsResponse. */
export interface AdminCategoryConditionsResponse {
  categoryId: Guid;
  categoryVersion: number;
  inheritanceMode: InheritanceMode;
  isConditionRequired: boolean;
  directAssignments: AdminCategoryConditionDto[];
  inheritedAssignments: AdminCategoryConditionDto[];
  effectiveConditions: AdminCategoryConditionDto[];
}

/** C# PublicGradeDto. */
export interface PublicGradeDto {
  gradeId: Guid;
  code: string;
  name: string;
}

/** C# PublicCategoryConditionDto. */
export interface PublicCategoryConditionDto {
  conditionId: Guid;
  code: string;
  name: string;
  isInherited: boolean;
  isGradeRequired: boolean;
  grades: PublicGradeDto[];
}

/** C# PublicCategoryConditionsResponse. */
export interface PublicCategoryConditionsResponse {
  categoryId: Guid;
  isConditionRequired: boolean;
  conditions: PublicCategoryConditionDto[];
}

export type ConditionErrorCode =
  | 'CONDITION_NOT_FOUND' // 404
  | 'CONDITION_CODE_ALREADY_EXISTS' // 409
  | 'CONDITION_NAME_ALREADY_EXISTS' // 409
  | 'CONDITION_CONCURRENCY_CONFLICT' // 409
  | 'CONDITION_ALREADY_ACTIVE' // 409
  | 'CONDITION_ALREADY_INACTIVE' // 409
  | 'GRADE_NOT_FOUND' // 404 (PUT grades)
  | 'GRADE_ALREADY_INACTIVE' // 409 (PUT grades)
  | 'CONDITION_GRADE_MAPPING_CONFLICT' // 409 (empty grade list while a category requires grades)
  | 'INVALID_DATA'; // 400

export type GradeErrorCode =
  | 'GRADE_NOT_FOUND' // 404
  | 'GRADE_CODE_ALREADY_EXISTS' // 409
  | 'GRADE_NAME_ALREADY_EXISTS' // 409
  | 'GRADE_CONCURRENCY_CONFLICT' // 409
  | 'GRADE_ALREADY_ACTIVE' // 409
  | 'GRADE_ALREADY_INACTIVE' // 409
  | 'INVALID_DATA'; // 400 (model validation)

export type CategoryConditionsErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'CONDITION_NOT_FOUND' // 404
  | 'INVALID_INHERITANCE_MODE' // 400
  | 'INVALID_DATA' // 400
  | 'CATEGORY_CONCURRENCY_CONFLICT' // 409
  | 'CATEGORY_INACTIVE' // 409
  | 'CONDITION_ALREADY_INACTIVE' // 409
  | 'GRADE_REQUIRED_BUT_NO_ACTIVE_GRADES'; // 409

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Domain.Units.UnitTypes. Input is trimmed + uppercased server-side. */
export type UnitType = 'COUNT' | 'MASS' | 'LENGTH' | 'AREA' | 'VOLUME' | 'PACKAGE';
export const UNIT_TYPES = ['COUNT', 'MASS', 'LENGTH', 'AREA', 'VOLUME', 'PACKAGE'] as const;

export const UNIT_LIMITS = {
  codeMaxLength: 50, // [StringLength(50)]; trimmed + lowercased server-side
  nameMaxLength: 100, // [StringLength(100)]
  symbolMaxLength: 20, // [StringLength(20)]
  descriptionMaxLength: 500, // [StringLength(500)]
  unitTypeMaxLength: 50, // [StringLength(50)]
  decimalPrecisionMin: 0, // [Range(0, 6)]
  decimalPrecisionMax: 6,
  quantityDecimalPrecisionMin: 0, // [Range(0, 6)]
  quantityDecimalPrecisionMax: 6,
  minQuantityExclusiveMin: 0, // SQL: minQuantity must be > 0 when provided ([Range] allows 0)
} as const;

/** C# CreateUnitRequest. */
export interface CreateUnitRequest {
  code: string;
  name: string;
  symbol: string;
  description?: string | null;
  unitType: UnitType;
  decimalPrecision: number; // 0..6
}

/** C# UpdateUnitRequest (code and unitType immutable). */
export interface UpdateUnitRequest {
  name: string;
  symbol: string;
  description?: string | null;
  decimalPrecision: number; // 0..6
  expectedVersion: number;
}

/** C# UnitResponse. */
export interface UnitResponse {
  unitId: Guid;
  code: string;
  name: string;
  symbol: string;
  description: string | null;
  unitType: UnitType;
  decimalPrecision: number;
  isActive: boolean;
  version: number;
  createdAtUtc: IsoDateTime;
  createdByUserId: Guid;
  updatedAtUtc: IsoDateTime | null;
  updatedByUserId: Guid | null;
}

/** C# DirectCategoryUnitRequest. */
export interface DirectCategoryUnitRequest {
  unitId: Guid;
  displayOrder: number;
  minQuantity?: number | null; // > 0 (SQL), >= 0 ([Range])
  maxQuantity?: number | null; // >= minQuantity
  quantityDecimalPrecision?: number | null; // 0..6
}

/** C# UpdateCategoryUnitsRequest (PUT replaces config + full DIRECT set). */
export interface UpdateCategoryUnitsRequest {
  expectedCategoryVersion: number;
  inheritanceMode: InheritanceMode; // regex ^(INHERIT|OVERRIDE)$, case-sensitive
  defaultUnitId?: Guid | null;
  units: DirectCategoryUnitRequest[]; // each unitId at most once (409 CATEGORY_UNIT_ALREADY_ASSIGNED); fixed in R3-A
}

/** C# AdminCategoryUnitItem. */
export interface AdminCategoryUnitItem {
  unitId: Guid;
  code: string;
  name: string;
  symbol: string;
  unitType: UnitType;
  decimalPrecision: number;
  displayOrder: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityDecimalPrecision: number | null; // in effectiveUnits: falls back to unit decimalPrecision (never null)
  isActive: boolean; // always true in effectiveUnits
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# AdminCategoryUnitsResponse. */
export interface AdminCategoryUnitsResponse {
  categoryId: Guid;
  categoryVersion: number; // 0 when the category does not exist
  inheritanceMode: InheritanceMode; // 'INHERIT' when no config row
  defaultUnitId: Guid | null; // configured (direct) default, not resolved
  directAssignments: AdminCategoryUnitItem[];
  inheritedAssignments: AdminCategoryUnitItem[];
  effectiveUnits: AdminCategoryUnitItem[];
}

/** C# PublicCategoryUnitItem. */
export interface PublicCategoryUnitItem {
  unitId: Guid;
  code: string;
  name: string;
  symbol: string;
  unitType: UnitType;
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityDecimalPrecision: number | null; // falls back to unit decimalPrecision => never null in practice
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# PublicCategoryUnitsResponse. defaultUnitId is the RESOLVED effective default. */
export interface PublicCategoryUnitsResponse {
  categoryId: Guid;
  defaultUnitId: Guid | null;
  units: PublicCategoryUnitItem[];
}

export type UnitErrorCode =
  | 'UNIT_NOT_FOUND' // 404
  | 'UNIT_CODE_ALREADY_EXISTS' // 409
  | 'UNIT_NAME_ALREADY_EXISTS' // 409
  | 'UNIT_CONCURRENCY_CONFLICT' // 409
  | 'UNIT_ALREADY_ACTIVE' // 409
  | 'UNIT_ALREADY_INACTIVE' // 409
  | 'INVALID_UNIT_TYPE' // 400
  | 'INVALID_QUANTITY_PRECISION' // 400 (unreachable in practice: [Range] fires first => INVALID_DATA)
  | 'INVALID_DATA'; // 400

export type CategoryUnitsErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'UNIT_NOT_FOUND' // 404
  | 'INVALID_INHERITANCE_MODE' // 400
  | 'INVALID_QUANTITY_RANGE' // 400
  | 'INVALID_QUANTITY_PRECISION' // 400
  | 'DEFAULT_UNIT_NOT_EFFECTIVE' // 400
  | 'INVALID_DATA' // 400 (model validation)
  | 'CATEGORY_CONCURRENCY_CONFLICT' // 409
  | 'CATEGORY_INACTIVE' // 409
  | 'UNIT_INACTIVE' // 409
  | 'CATEGORY_UNIT_ALREADY_ASSIGNED'; // 409

// ---------------------------------------------------------------------------
// Listing requirements (public)
// ---------------------------------------------------------------------------

/** C# Emcore.CatalogListing.Contracts.Validation.ListingRequirementsResponse. */
export interface ListingRequirementsResponse {
  categoryId: Guid;
  attributes: EffectiveCategoryAttributeResponse[];
  brands: EffectiveCategoryBrandResponse[];
  unitRules: PublicCategoryUnitsResponse;
  conditionRules: PublicCategoryConditionsResponse;
}

export type PublicCategorySchemaErrorCode =
  | 'CATEGORY_NOT_FOUND' // 404
  | 'CATEGORY_INACTIVE' // 409
  | 'CATEGORY_HIERARCHY_INVALID'; // 409 (inactive ancestor)
