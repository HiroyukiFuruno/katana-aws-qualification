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
      'NACL OUT: destination TCP 49152',
      'Request: ALB 49152 → EC2 443',
      'Response: EC2 443 → ALB 49152',
    ],
  },
] as const;

for (const figure of figures) {
  test(`${figure.name} keeps all labels within the mobile SVG`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const response = await page.goto(lessonFigures[figure.id].url);
    expect(response?.ok()).toBe(true);

    await expect(page.locator('svg foreignObject')).toHaveCount(0);
    const labels = page.locator('svg text');
    await expect.poll(() => labels.allTextContents()).toEqual(expect.arrayContaining(figure.labels));
    await page.evaluate(() => document.fonts.ready);
    expect(
      await labels.evaluateAll((elements) =>
        elements.every((element) => {
          if (!(element instanceof SVGTextElement) || !element.ownerSVGElement) return false;
          const bounds = element.getBBox();
          const view = element.ownerSVGElement.viewBox.baseVal;
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.x >= view.x &&
            bounds.y >= view.y &&
            bounds.x + bounds.width <= view.x + view.width &&
            bounds.y + bounds.height <= view.y + view.height
          );
        }),
      ),
    ).toBe(true);
  });
}
