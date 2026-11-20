const replacedCertifications = new Map([
  ['dva-c02', 'dva-c03'],
  ['sap-c02', 'sap-c03'],
]);

export function normalizeCertificationId(id: string) {
  return replacedCertifications.get(id) ?? id;
}
