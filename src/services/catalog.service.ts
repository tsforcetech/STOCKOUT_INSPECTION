import { http, type QueryParams } from "@/lib/api/client";
import { unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AdminAttributeDefinitionResponse,
  AdminCategoryAttributesResultResponse,
  AdminCategoryBrandResponse,
  AdminCategoryConditionsResponse,
  AdminCategoryListQuery,
  AdminCategoryResponse,
  AdminCategoryUnitsResponse,
  AttributeOptionResponse,
  BrandResponse,
  ConditionGradeResponse,
  ConditionResponse,
  CreateAttributeDefinitionRequest,
  CreateAttributeOptionRequest,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateConditionRequest,
  CreateGradeRequest,
  CreateUnitRequest,
  GradeResponse,
  ReplaceCategoryAttributesRequest,
  ReplaceCategoryBrandsRequest,
  UnitResponse,
  UpdateAttributeDefinitionRequest,
  UpdateAttributeOptionRequest,
  UpdateBrandRequest,
  UpdateCategoryConditionsRequest,
  UpdateCategoryRequest,
  UpdateCategoryUnitsRequest,
  UpdateConditionGradesRequest,
  UpdateConditionRequest,
  UpdateGradeRequest,
  UpdateUnitRequest,
} from "@/api/types/catalog-taxonomy";

/**
 * catalog-listing taxonomy admin API: /api/v1/admin/catalog/*.
 * Every success body is { success, data }. No endpoint paginates — lists are complete arrays.
 * Deactivate/reactivate carry `expectedVersion` in the QUERY for attributes, options, brands and
 * categories, but in the JSON BODY for units, conditions and grades (contract §1.9).
 * Contract: docs/contracts/catalog-taxonomy.md
 */
const BASE = "/api/v1/admin/catalog";
const seg = encodeURIComponent;

const get = async <T>(path: string, signal?: AbortSignal, query?: QueryParams) => unwrapData<T>(await http.get<Envelope<T>>(`${BASE}${path}`, { signal, query }));
const post = async <T>(path: string, body?: unknown, query?: QueryParams) => unwrapData<T>(await http.post<Envelope<T>>(`${BASE}${path}`, body, { query }));
const put = async <T>(path: string, body: unknown) => unwrapData<T>(await http.put<Envelope<T>>(`${BASE}${path}`, body));

/** ?expectedVersion=<int> (attributes, options, brands, categories). */
const versionQuery = (expectedVersion: number): QueryParams => ({ expectedVersion });
/** { expectedVersion } JSON body (units, conditions, grades). */
const versionBody = (expectedVersion: number) => ({ expectedVersion });

export const catalogService = {
  // Attributes (A1–A11)
  attributes: (signal?: AbortSignal) => get<AdminAttributeDefinitionResponse[]>("/attributes", signal),
  attribute: (id: string, signal?: AbortSignal) => get<AdminAttributeDefinitionResponse>(`/attributes/${seg(id)}`, signal),
  createAttribute: (body: CreateAttributeDefinitionRequest) => post<AdminAttributeDefinitionResponse>("/attributes", body),
  updateAttribute: (id: string, body: UpdateAttributeDefinitionRequest) => put<AdminAttributeDefinitionResponse>(`/attributes/${seg(id)}`, body),
  deactivateAttribute: (id: string, expectedVersion: number) => post<AdminAttributeDefinitionResponse>(`/attributes/${seg(id)}/deactivate`, undefined, versionQuery(expectedVersion)),
  reactivateAttribute: (id: string, expectedVersion: number) => post<AdminAttributeDefinitionResponse>(`/attributes/${seg(id)}/reactivate`, undefined, versionQuery(expectedVersion)),
  attributeOptions: (id: string, signal?: AbortSignal) => get<AttributeOptionResponse[]>(`/attributes/${seg(id)}/options`, signal),
  createAttributeOption: (id: string, body: CreateAttributeOptionRequest) => post<AttributeOptionResponse>(`/attributes/${seg(id)}/options`, body),
  updateAttributeOption: (id: string, optionId: string, body: UpdateAttributeOptionRequest) => put<AttributeOptionResponse>(`/attributes/${seg(id)}/options/${seg(optionId)}`, body),
  deactivateAttributeOption: (id: string, optionId: string, expectedVersion: number) =>
    post<AttributeOptionResponse>(`/attributes/${seg(id)}/options/${seg(optionId)}/deactivate`, undefined, versionQuery(expectedVersion)),
  reactivateAttributeOption: (id: string, optionId: string, expectedVersion: number) =>
    post<AttributeOptionResponse>(`/attributes/${seg(id)}/options/${seg(optionId)}/reactivate`, undefined, versionQuery(expectedVersion)),

  // Brands (B1–B6)
  brands: (signal?: AbortSignal) => get<BrandResponse[]>("/brands", signal),
  brand: (id: string, signal?: AbortSignal) => get<BrandResponse>(`/brands/${seg(id)}`, signal),
  createBrand: (body: CreateBrandRequest) => post<BrandResponse>("/brands", body),
  updateBrand: (id: string, body: UpdateBrandRequest) => put<BrandResponse>(`/brands/${seg(id)}`, body),
  deactivateBrand: (id: string, expectedVersion: number) => post<BrandResponse>(`/brands/${seg(id)}/deactivate`, undefined, versionQuery(expectedVersion)),
  reactivateBrand: (id: string, expectedVersion: number) => post<BrandResponse>(`/brands/${seg(id)}/reactivate`, undefined, versionQuery(expectedVersion)),

  // Categories (C1–C6)
  categories: (query: AdminCategoryListQuery = {}, signal?: AbortSignal) =>
    get<AdminCategoryResponse[]>("/categories", signal, { search: query.search, parentCategoryId: query.parentCategoryId, isActive: query.isActive }),
  category: (id: string, signal?: AbortSignal) => get<AdminCategoryResponse>(`/categories/${seg(id)}`, signal),
  createCategory: (body: CreateCategoryRequest) => post<AdminCategoryResponse>("/categories", body),
  updateCategory: (id: string, body: UpdateCategoryRequest) => put<AdminCategoryResponse>(`/categories/${seg(id)}`, body),
  deactivateCategory: (id: string, expectedVersion: number) => post<AdminCategoryResponse>(`/categories/${seg(id)}/deactivate`, undefined, versionQuery(expectedVersion)),
  reactivateCategory: (id: string, expectedVersion: number) => post<AdminCategoryResponse>(`/categories/${seg(id)}/reactivate`, undefined, versionQuery(expectedVersion)),

  // Category mappings (CA1/CA2, CB1/CB2, CC1/CC2, CU1/CU2). Each PUT bumps the category version.
  categoryAttributes: (id: string, signal?: AbortSignal) => get<AdminCategoryAttributesResultResponse>(`/categories/${seg(id)}/attributes`, signal),
  replaceCategoryAttributes: (id: string, body: ReplaceCategoryAttributesRequest) => put<AdminCategoryAttributesResultResponse>(`/categories/${seg(id)}/attributes`, body),
  /** Bare array without categoryVersion — take the version from the category itself (C2). */
  categoryBrands: (id: string, signal?: AbortSignal) => get<AdminCategoryBrandResponse[]>(`/categories/${seg(id)}/brands`, signal),
  replaceCategoryBrands: (id: string, body: ReplaceCategoryBrandsRequest) => put<AdminCategoryBrandResponse[]>(`/categories/${seg(id)}/brands`, body),
  categoryConditions: (id: string, signal?: AbortSignal) => get<AdminCategoryConditionsResponse>(`/categories/${seg(id)}/conditions`, signal),
  updateCategoryConditions: (id: string, body: UpdateCategoryConditionsRequest) => put<AdminCategoryConditionsResponse>(`/categories/${seg(id)}/conditions`, body),
  categoryUnits: (id: string, signal?: AbortSignal) => get<AdminCategoryUnitsResponse>(`/categories/${seg(id)}/units`, signal),
  /** Replaces the direct units. Duplicate unitIds → 409 CATEGORY_UNIT_ALREADY_ASSIGNED (fixed R3-A; non-empty lists save). */
  updateCategoryUnits: (id: string, body: UpdateCategoryUnitsRequest) => put<AdminCategoryUnitsResponse>(`/categories/${seg(id)}/units`, body),

  // Conditions (D1–D8)
  conditions: (signal?: AbortSignal) => get<ConditionResponse[]>("/conditions", signal),
  condition: (id: string, signal?: AbortSignal) => get<ConditionResponse>(`/conditions/${seg(id)}`, signal),
  createCondition: (body: CreateConditionRequest) => post<ConditionResponse>("/conditions", body),
  updateCondition: (id: string, body: UpdateConditionRequest) => put<ConditionResponse>(`/conditions/${seg(id)}`, body),
  deactivateCondition: (id: string, expectedVersion: number) => post<ConditionResponse>(`/conditions/${seg(id)}/deactivate`, versionBody(expectedVersion)),
  reactivateCondition: (id: string, expectedVersion: number) => post<ConditionResponse>(`/conditions/${seg(id)}/reactivate`, versionBody(expectedVersion)),
  conditionGrades: (id: string, signal?: AbortSignal) => get<ConditionGradeResponse[]>(`/conditions/${seg(id)}/grades`, signal),
  replaceConditionGrades: (id: string, body: UpdateConditionGradesRequest) => put<ConditionGradeResponse[]>(`/conditions/${seg(id)}/grades`, body),

  // Grades (G1–G6)
  grades: (signal?: AbortSignal) => get<GradeResponse[]>("/grades", signal),
  grade: (id: string, signal?: AbortSignal) => get<GradeResponse>(`/grades/${seg(id)}`, signal),
  createGrade: (body: CreateGradeRequest) => post<GradeResponse>("/grades", body),
  updateGrade: (id: string, body: UpdateGradeRequest) => put<GradeResponse>(`/grades/${seg(id)}`, body),
  deactivateGrade: (id: string, expectedVersion: number) => post<GradeResponse>(`/grades/${seg(id)}/deactivate`, versionBody(expectedVersion)),
  reactivateGrade: (id: string, expectedVersion: number) => post<GradeResponse>(`/grades/${seg(id)}/reactivate`, versionBody(expectedVersion)),

  // Units (U1–U6)
  units: (signal?: AbortSignal) => get<UnitResponse[]>("/units", signal),
  unit: (id: string, signal?: AbortSignal) => get<UnitResponse>(`/units/${seg(id)}`, signal),
  createUnit: (body: CreateUnitRequest) => post<UnitResponse>("/units", body),
  updateUnit: (id: string, body: UpdateUnitRequest) => put<UnitResponse>(`/units/${seg(id)}`, body),
  deactivateUnit: (id: string, expectedVersion: number) => post<UnitResponse>(`/units/${seg(id)}/deactivate`, versionBody(expectedVersion)),
  reactivateUnit: (id: string, expectedVersion: number) => post<UnitResponse>(`/units/${seg(id)}/reactivate`, versionBody(expectedVersion)),
};
