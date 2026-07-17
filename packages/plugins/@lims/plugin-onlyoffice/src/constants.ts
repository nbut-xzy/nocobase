/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/** OnlyOffice callback resource action name (the API base URL prefix is resolved at runtime). */
export const ONLYOFFICE_CALLBACK_ACTION = 'onlyoffice:callback';

/** File extension → OnlyOffice document type and file type mapping. */
export const EXT_TO_DOC_TYPE: Record<string, { documentType: string; fileType: string }> = {
  doc: { documentType: 'word', fileType: 'doc' },
  docx: { documentType: 'word', fileType: 'docx' },
  docm: { documentType: 'word', fileType: 'docm' },
  dot: { documentType: 'word', fileType: 'dot' },
  dotx: { documentType: 'word', fileType: 'dotx' },
  dotm: { documentType: 'word', fileType: 'dotm' },
  odt: { documentType: 'word', fileType: 'odt' },
  ott: { documentType: 'word', fileType: 'ott' },
  rtf: { documentType: 'word', fileType: 'rtf' },
  txt: { documentType: 'word', fileType: 'txt' },
  htm: { documentType: 'word', fileType: 'htm' },
  html: { documentType: 'word', fileType: 'html' },
  mht: { documentType: 'word', fileType: 'mht' },
  mhtml: { documentType: 'word', fileType: 'mhtml' },
  epub: { documentType: 'word', fileType: 'epub' },
  fb2: { documentType: 'word', fileType: 'fb2' },
  fodt: { documentType: 'word', fileType: 'fodt' },
  stw: { documentType: 'word', fileType: 'stw' },
  sxw: { documentType: 'word', fileType: 'sxw' },
  wps: { documentType: 'word', fileType: 'wps' },
  wpt: { documentType: 'word', fileType: 'wpt' },
  pages: { documentType: 'word', fileType: 'pages' },
  md: { documentType: 'word', fileType: 'md' },
  xls: { documentType: 'cell', fileType: 'xls' },
  xlsx: { documentType: 'cell', fileType: 'xlsx' },
  xlsm: { documentType: 'cell', fileType: 'xlsm' },
  xlt: { documentType: 'cell', fileType: 'xlt' },
  xltx: { documentType: 'cell', fileType: 'xltx' },
  xltm: { documentType: 'cell', fileType: 'xltm' },
  csv: { documentType: 'cell', fileType: 'csv' },
  ods: { documentType: 'cell', fileType: 'ods' },
  ots: { documentType: 'cell', fileType: 'ots' },
  fods: { documentType: 'cell', fileType: 'fods' },
  sxc: { documentType: 'cell', fileType: 'sxc' },
  et: { documentType: 'cell', fileType: 'et' },
  ett: { documentType: 'cell', fileType: 'ett' },
  ppt: { documentType: 'slide', fileType: 'ppt' },
  pptx: { documentType: 'slide', fileType: 'pptx' },
  pptm: { documentType: 'slide', fileType: 'pptm' },
  pps: { documentType: 'slide', fileType: 'pps' },
  ppsx: { documentType: 'slide', fileType: 'ppsx' },
  ppsm: { documentType: 'slide', fileType: 'ppsm' },
  pot: { documentType: 'slide', fileType: 'pot' },
  potx: { documentType: 'slide', fileType: 'potx' },
  potm: { documentType: 'slide', fileType: 'potm' },
  odp: { documentType: 'slide', fileType: 'odp' },
  otp: { documentType: 'slide', fileType: 'otp' },
  fodp: { documentType: 'slide', fileType: 'fodp' },
  sxi: { documentType: 'slide', fileType: 'sxi' },
  dps: { documentType: 'slide', fileType: 'dps' },
  dpt: { documentType: 'slide', fileType: 'dpt' },
  pdf: { documentType: 'pdf', fileType: 'pdf' },
  djvu: { documentType: 'pdf', fileType: 'djvu' },
  xps: { documentType: 'pdf', fileType: 'xps' },
  oxps: { documentType: 'pdf', fileType: 'oxps' },
};

/** Detect OnlyOffice document type and file type from a file URL extension. */
export function detectFromUrl(url: string): { documentType: string; fileType: string } | null {
  if (!url) return null;
  const cleaned = url.split('?')[0].split('#')[0];
  const ext = cleaned.split('.').pop()?.toLowerCase();
  return ext && EXT_TO_DOC_TYPE[ext] ? EXT_TO_DOC_TYPE[ext] : null;
}

/** Detect document type and file type with sensible defaults (word/docx) when unknown. */
export function resolveDocType(url: string): { documentType: string; fileType: string } {
  const detected = detectFromUrl(url);
  const documentType = detected?.documentType || 'word';
  const fileType =
    detected?.fileType ||
    (documentType === 'word' ? 'docx' : documentType === 'cell' ? 'xlsx' : documentType === 'slide' ? 'pptx' : 'pdf');
  return { documentType, fileType };
}
