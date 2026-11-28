import { expect, test } from '@playwright/test';
import lessonFigures from '../../src/fundamentals/delivery/lesson-figures.json' with { type: 'json' };

const figures = [
  {
    name: 'EC2 and S3 responsibility comparison',
    id: 'fundamentals.cloud-concepts:section:shared-responsibility:concept:1',
    labels: [
      'Amazon EC2',
      'Amazon S3',
      'Customer responsibilities',
      'Both: protect data and manage access',
      'Patch the guest OS',
      'Configure applications',
      'Set bucket permissions',
      'Choose data encryption',
      'AWS responsibilities',
      'Run the physical host',
      'Manage the hypervisor',
      'Run the service OS',
      'Manage storage systems',
    ],
  },
  {
    name: 'S3 object encryption and the separate KMS boundary',
    id: 'fundamentals.data-protection:section:encryption:concept:1',
    labels: [
      'Amazon S3 boundary',
      'S3 object',
      'AWS KMS boundary',
      'KMS key',
      'SSE-KMS: request a data key',
      'AWS KMS returns the data key',
    ],
  },
  {
    name: 'three IPv4 internet paths',
    id: 'fundamentals.routing-connectivity:section:internet-egress:concept:1',
    labels: [
      '1. Direct inbound to EC2',
      '2. Outbound through a public NAT gateway',
      '3. Inbound through a public ALB',
    ],
  },
  {
    name: 'ALB to EC2 request and return traffic',
    id: 'fundamentals.routing-connectivity:section:traffic-controls:concept:1',
    labels: [
      'ALB SG (ENI)',
      'EC2 SG (ENI)',
      'NACL OUT: destination TCP 49152',
      'Request: ALB 49152 → EC2 443',
      'Response: EC2 443 → ALB 49152',
    ],
    groups: [
      { label: 'ALB SG (ENI)', resource: 'alb' },
      { label: 'EC2 SG (ENI)', resource: 'ec2' },
    ],
  },
] as const;

for (const [id, asset] of Object.entries(lessonFigures)) {
  const reference = figures.find((figure) => figure.id === id);
  test(`${reference?.name ?? asset.url} fits the mobile SVG`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ colorScheme: 'dark' });
    const response = await page.goto(asset.url);
    expect(response?.ok()).toBe(true);

    await expect(page.locator('svg foreignObject')).toHaveCount(0);
    const background = page.locator('svg > rect').first();
    await expect(background).toHaveAttribute('width', '100%');
    await expect(background).toHaveAttribute('height', '100%');
    await expect(background).toHaveCSS('fill', 'rgb(255, 255, 255)');
    const labels = page.locator('svg text');
    expect(await labels.count()).toBeGreaterThan(0);
    if (reference) {
      await expect
        .poll(() => labels.allTextContents())
        .toEqual(expect.arrayContaining(reference.labels));
    }
    if (reference?.id === 'fundamentals.data-protection:section:encryption:concept:1') {
      const key = '[data-cell-id="kms"]';
      await expect(page.locator(`[data-cell-id="kms-boundary"] ${key}`)).toHaveCount(1);
      await expect(page.locator(`[data-cell-id="s3-boundary"] ${key}`)).toHaveCount(0);
    }
    await page.evaluate(() => document.fonts.ready);
    if (reference && 'groups' in reference) {
      for (const group of reference.groups) {
        const label = labels.filter({ hasText: group.label });
        const resource = page.locator(`[data-cell-id="${group.resource}"] rect`).first();
        const labelBox = await label.boundingBox();
        const resourceBox = await resource.boundingBox();
        expect(labelBox && resourceBox && labelBox.y + labelBox.height <= resourceBox.y).toBe(true);
      }
    }

    const clippedLabels = await labels.evaluateAll((elements) => {
      const svg = document.documentElement;
      const frame = svg.getBoundingClientRect();
      return elements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width <= 0 ||
            bounds.height <= 0 ||
            bounds.left < frame.left - 0.5 ||
            bounds.top < frame.top - 0.5 ||
            bounds.right > frame.right + 0.5 ||
            bounds.bottom > frame.bottom + 0.5
          );
        })
        .map((element) => element.textContent);
    });
    expect(clippedLabels).toEqual([]);
  });
}
