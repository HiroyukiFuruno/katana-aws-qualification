-- Generated from public/fundamentals/delivery/trustedCatalog.json. Do not edit manually.
-- The hash is Node canonical JSON SHA-256, stored as decode(hex, 'hex').
begin;

insert into public.published_fundamentals_catalogs (
  unit_id, content_version, content_hash, plan, final_questions
) values
  ('fundamentals.cloud-concepts', 'd4bcfd5eb394d75364a75fb20e551b57296e6aaa7fcbfb88800c06568524f4a6', decode('14a2cd96f335b065fb69cfdaacf9193d5280af8cea756c3c58efafa4aae99e97', 'hex'),
    $kaq_plan_1_0$[
  {
    "id": "fundamentals.cloud-concepts:intro:orientation:1",
    "kind": "slide",
    "position": 1,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:intro:objectives:1",
    "kind": "slide",
    "position": 2,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:intro:objectives:2",
    "kind": "slide",
    "position": 3,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:concept:1",
    "kind": "slide",
    "position": 4,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:concept:2",
    "kind": "slide",
    "position": 5,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:example:1",
    "kind": "slide",
    "position": 6,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:example:2",
    "kind": "slide",
    "position": 7,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:misconception:1",
    "kind": "slide",
    "position": 8,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:on-demand:takeaway:1",
    "kind": "slide",
    "position": 9,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:checkpoint:fundamentals.cloud-concepts.checkpoint.on-demand.v1",
    "kind": "checkpoint",
    "position": 10,
    "question": {
      "category": "fundamentals.cloud-concepts",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.cloud-concepts.checkpoint.on-demand.v1",
      "objectiveId": "cloud-1",
      "questionId": "fundamentals.cloud-concepts.checkpoint.on-demand.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "on-demand",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS cloud computing advantages",
        "url": "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:concept:1",
    "kind": "slide",
    "position": 11,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:concept:2",
    "kind": "slide",
    "position": 12,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:example:1",
    "kind": "slide",
    "position": 13,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:example:2",
    "kind": "slide",
    "position": 14,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:misconception:1",
    "kind": "slide",
    "position": 15,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:shared-responsibility:takeaway:1",
    "kind": "slide",
    "position": 16,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:checkpoint:fundamentals.cloud-concepts.checkpoint.shared-responsibility.v1",
    "kind": "checkpoint",
    "position": 17,
    "question": {
      "category": "fundamentals.cloud-concepts",
      "choiceIds": [
        "B",
        "A",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.cloud-concepts.checkpoint.shared-responsibility.v1",
      "objectiveId": "cloud-2",
      "questionId": "fundamentals.cloud-concepts.checkpoint.shared-responsibility.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "shared-responsibility",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS shared responsibility model",
        "url": "https://aws.amazon.com/compliance/shared-responsibility-model/"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:concept:1",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:concept:2",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:example:1",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:example:2",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:misconception:1",
    "kind": "slide",
    "position": 22,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:regions-az:takeaway:1",
    "kind": "slide",
    "position": 23,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:checkpoint:fundamentals.cloud-concepts.checkpoint.regions-az.v1",
    "kind": "checkpoint",
    "position": 24,
    "question": {
      "category": "fundamentals.cloud-concepts",
      "choiceIds": [
        "C",
        "A",
        "B",
        "D"
      ],
      "correctChoiceIds": [
        "C"
      ],
      "explanationRef": "checkpoint:fundamentals.cloud-concepts.checkpoint.regions-az.v1",
      "objectiveId": "cloud-3",
      "questionId": "fundamentals.cloud-concepts.checkpoint.regions-az.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "regions-az",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS Regions and Availability Zones",
        "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:concept:1",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:concept:2",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:example:1",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:example:2",
    "kind": "slide",
    "position": 28,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:misconception:1",
    "kind": "slide",
    "position": 29,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:section:tradeoffs:takeaway:1",
    "kind": "slide",
    "position": 30,
    "required": true
  },
  {
    "id": "fundamentals.cloud-concepts:checkpoint:fundamentals.cloud-concepts.checkpoint.tradeoffs.v1",
    "kind": "checkpoint",
    "position": 31,
    "question": {
      "category": "fundamentals.cloud-concepts",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A",
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.cloud-concepts.checkpoint.tradeoffs.v1",
      "objectiveId": "cloud-4",
      "questionId": "fundamentals.cloud-concepts.checkpoint.tradeoffs.v1",
      "requiredChoices": 2,
      "revision": 1,
      "sectionId": "tradeoffs",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS Regions and Availability Zones",
        "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_1_0$::jsonb,
    $kaq_final_1_0$[
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-cloud-101",
    "objectiveId": "cloud-1",
    "questionId": "fund-cloud-101",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "on-demand",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Six advantages of cloud computing",
      "url": "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 0
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-cloud-102",
    "objectiveId": "cloud-1",
    "questionId": "fund-cloud-102",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "on-demand",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Six advantages of cloud computing",
      "url": "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 1
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "B"
    ],
    "explanationRef": "final:fund-cloud-103",
    "objectiveId": "cloud-1",
    "questionId": "fund-cloud-103",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "on-demand",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Six advantages of cloud computing",
      "url": "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 2
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-cloud-001",
    "objectiveId": "cloud-2",
    "questionId": "fund-cloud-001",
    "requiredChoices": 1,
    "revision": 2,
    "sectionId": "shared-responsibility",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Shared Responsibility Model",
      "url": "https://aws.amazon.com/compliance/shared-responsibility-model/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 3
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-cloud-105",
    "objectiveId": "cloud-2",
    "questionId": "fund-cloud-105",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "shared-responsibility",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Shared Responsibility Model",
      "url": "https://aws.amazon.com/compliance/shared-responsibility-model/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 4
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "C",
      "D"
    ],
    "explanationRef": "final:fund-cloud-106",
    "objectiveId": "cloud-2",
    "questionId": "fund-cloud-106",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "shared-responsibility",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Shared Responsibility Model",
      "url": "https://aws.amazon.com/compliance/shared-responsibility-model/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 5
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-cloud-002",
    "objectiveId": "cloud-3",
    "questionId": "fund-cloud-002",
    "requiredChoices": 1,
    "revision": 2,
    "sectionId": "regions-az",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 6
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "B"
    ],
    "explanationRef": "final:fund-cloud-108",
    "objectiveId": "cloud-3",
    "questionId": "fund-cloud-108",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "regions-az",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 7
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "C",
      "D"
    ],
    "explanationRef": "final:fund-cloud-109",
    "objectiveId": "cloud-3",
    "questionId": "fund-cloud-109",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "regions-az",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 8
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-cloud-110",
    "objectiveId": "cloud-4",
    "questionId": "fund-cloud-110",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "tradeoffs",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 9
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "B"
    ],
    "explanationRef": "final:fund-cloud-111",
    "objectiveId": "cloud-4",
    "questionId": "fund-cloud-111",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "tradeoffs",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 10
  },
  {
    "category": "クラウド概念",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "C"
    ],
    "explanationRef": "final:fund-cloud-112",
    "objectiveId": "cloud-4",
    "questionId": "fund-cloud-112",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "tradeoffs",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS: Regions and Availability Zones",
      "url": "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 11
  }
]$kaq_final_1_0$::jsonb),
  ('fundamentals.routing-connectivity', '343e7fe4fcc0cfdd42fe32db6a0dd782050a7816a5f5884df86715bad63fcf9d', decode('97f40ffca183865f50371b60d27a174c64c66199a7069f7628fd5173cb914506', 'hex'),
    $kaq_plan_8_0$[
  {
    "id": "fundamentals.routing-connectivity:intro:orientation:1",
    "kind": "slide",
    "position": 1,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:intro:objectives:1",
    "kind": "slide",
    "position": 2,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:intro:objectives:2",
    "kind": "slide",
    "position": 3,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:route-selection:concept:1",
    "kind": "slide",
    "position": 4,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:route-selection:example:1",
    "kind": "slide",
    "position": 5,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:route-selection:example:2",
    "kind": "slide",
    "position": 6,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:route-selection:misconception:1",
    "kind": "slide",
    "position": 7,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:route-selection:takeaway:1",
    "kind": "slide",
    "position": 8,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.route-selection.v1",
    "kind": "checkpoint",
    "position": 9,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "C",
        "A",
        "B",
        "D"
      ],
      "correctChoiceIds": [
        "C"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.route-selection.v1",
      "objectiveId": "route-1",
      "questionId": "fundamentals.routing-connectivity.checkpoint.route-selection.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "route-selection",
      "selectionPolarity": "correct",
      "source": {
        "label": "VPC route tables",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:concept:1",
    "kind": "slide",
    "position": 10,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:concept:2",
    "kind": "slide",
    "position": 11,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:example:1",
    "kind": "slide",
    "position": 12,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:example:2",
    "kind": "slide",
    "position": 13,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:misconception:1",
    "kind": "slide",
    "position": 14,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:internet-egress:takeaway:1",
    "kind": "slide",
    "position": 15,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.internet-egress.v1",
    "kind": "checkpoint",
    "position": 16,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "C",
        "D",
        "A",
        "B"
      ],
      "correctChoiceIds": [
        "C",
        "D"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.internet-egress.v1",
      "objectiveId": "route-2",
      "questionId": "fundamentals.routing-connectivity.checkpoint.internet-egress.v1",
      "requiredChoices": 2,
      "revision": 1,
      "sectionId": "internet-egress",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS NAT and Internet Gateway",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:concept:1",
    "kind": "slide",
    "position": 17,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:concept:2",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:example:1",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:example:2",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:misconception:1",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:takeaway:1",
    "kind": "slide",
    "position": 22,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
    "kind": "checkpoint",
    "position": 23,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "D",
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "D"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
      "objectiveId": "route-3",
      "questionId": "fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "traffic-controls",
      "selectionPolarity": "correct",
      "source": {
        "label": "VPC infrastructure security",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:concept:1",
    "kind": "slide",
    "position": 24,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:concept:2",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:example:1",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:example:2",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:misconception:1",
    "kind": "slide",
    "position": 28,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:takeaway:1",
    "kind": "slide",
    "position": 29,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.private-paths.v1",
    "kind": "checkpoint",
    "position": 30,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.private-paths.v1",
      "objectiveId": "route-4",
      "questionId": "fundamentals.routing-connectivity.checkpoint.private-paths.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "private-paths",
      "selectionPolarity": "correct",
      "source": {
        "label": "VPC infrastructure security",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_8_0$::jsonb,
    $kaq_final_8_0$[
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-route-001",
    "objectiveId": "route-1",
    "questionId": "fund-route-001",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "route-selection",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon VPC route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 0
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-route-002",
    "objectiveId": "route-1",
    "questionId": "fund-route-002",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "route-selection",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Amazon VPC route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 1
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-route-003",
    "objectiveId": "route-1",
    "questionId": "fund-route-003",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "route-selection",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon VPC route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 2
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "C",
      "E"
    ],
    "explanationRef": "final:fund-route-004",
    "objectiveId": "route-2",
    "questionId": "fund-route-004",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "internet-egress",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Internet gateway basics",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 3
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-route-005",
    "objectiveId": "route-2",
    "questionId": "fund-route-005",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "internet-egress",
    "selectionPolarity": "correct",
    "source": {
      "label": "Troubleshoot NAT gateways",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-troubleshooting.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 4
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "D"
    ],
    "explanationRef": "final:fund-route-006",
    "objectiveId": "route-2",
    "questionId": "fund-route-006",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "internet-egress",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Troubleshoot NAT gateways",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-troubleshooting.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 5
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-route-007",
    "objectiveId": "route-3",
    "questionId": "fund-route-007",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "traffic-controls",
    "selectionPolarity": "correct",
    "source": {
      "label": "Infrastructure security in Amazon VPC",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 6
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "D"
    ],
    "explanationRef": "final:fund-route-008",
    "objectiveId": "route-3",
    "questionId": "fund-route-008",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "traffic-controls",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Infrastructure security in Amazon VPC",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 7
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-route-009",
    "objectiveId": "route-3",
    "questionId": "fund-route-009",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "traffic-controls",
    "selectionPolarity": "correct",
    "source": {
      "label": "Infrastructure security in Amazon VPC",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 8
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-route-010",
    "objectiveId": "route-4",
    "questionId": "fund-route-010",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "private-paths",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Amazon VPC route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 9
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "E"
    ],
    "explanationRef": "final:fund-route-011",
    "objectiveId": "route-4",
    "questionId": "fund-route-011",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "private-paths",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon VPC route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 10
  },
  {
    "category": "ルーティングと接続",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "D"
    ],
    "explanationRef": "final:fund-route-012",
    "objectiveId": "route-4",
    "questionId": "fund-route-012",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "private-paths",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Infrastructure security in Amazon VPC",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 11
  }
]$kaq_final_8_0$::jsonb),
  ('fundamentals.testing-quality', '9a9f7c6aeec0c3ca4926cbf1a7f58ea69a54a9102088866cf34b8fb0fdd078e4', decode('b585975f92b3790380ac5f3a92b11b08dc529b99bfc1897b5b805f6459711883', 'hex'),
    $kaq_plan_10_0$[
  {
    "id": "fundamentals.testing-quality:intro:orientation:1",
    "kind": "slide",
    "position": 1,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:intro:objectives:1",
    "kind": "slide",
    "position": 2,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:intro:objectives:2",
    "kind": "slide",
    "position": 3,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:concept:1",
    "kind": "slide",
    "position": 4,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:concept:2",
    "kind": "slide",
    "position": 5,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:example:1",
    "kind": "slide",
    "position": 6,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:example:2",
    "kind": "slide",
    "position": 7,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:misconception:1",
    "kind": "slide",
    "position": 8,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-levels:takeaway:1",
    "kind": "slide",
    "position": 9,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:checkpoint:fundamentals.testing-quality.checkpoint.test-levels.v1",
    "kind": "checkpoint",
    "position": 10,
    "question": {
      "category": "fundamentals.testing-quality",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.testing-quality.checkpoint.test-levels.v1",
      "objectiveId": "testing-1",
      "questionId": "fundamentals.testing-quality.checkpoint.test-levels.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "test-levels",
      "selectionPolarity": "correct",
      "source": {
        "label": "CodeBuild test reporting",
        "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:concept:1",
    "kind": "slide",
    "position": 11,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:concept:2",
    "kind": "slide",
    "position": 12,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:example:1",
    "kind": "slide",
    "position": 13,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:example:2",
    "kind": "slide",
    "position": 14,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:misconception:1",
    "kind": "slide",
    "position": 15,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:test-design:takeaway:1",
    "kind": "slide",
    "position": 16,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:checkpoint:fundamentals.testing-quality.checkpoint.test-design.v1",
    "kind": "checkpoint",
    "position": 17,
    "question": {
      "category": "fundamentals.testing-quality",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A",
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.testing-quality.checkpoint.test-design.v1",
      "objectiveId": "testing-2",
      "questionId": "fundamentals.testing-quality.checkpoint.test-design.v1",
      "requiredChoices": 2,
      "revision": 2,
      "sectionId": "test-design",
      "selectionPolarity": "correct",
      "source": {
        "label": "Well-Architected operations testing",
        "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops03-bp02.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:concept:1",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:concept:2",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:example:1",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:example:2",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:misconception:1",
    "kind": "slide",
    "position": 22,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:quality-gates:takeaway:1",
    "kind": "slide",
    "position": 23,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:checkpoint:fundamentals.testing-quality.checkpoint.quality-gates.v1",
    "kind": "checkpoint",
    "position": 24,
    "question": {
      "category": "fundamentals.testing-quality",
      "choiceIds": [
        "B",
        "C",
        "A",
        "D"
      ],
      "correctChoiceIds": [
        "B",
        "C"
      ],
      "explanationRef": "checkpoint:fundamentals.testing-quality.checkpoint.quality-gates.v1",
      "objectiveId": "testing-3",
      "questionId": "fundamentals.testing-quality.checkpoint.quality-gates.v1",
      "requiredChoices": 2,
      "revision": 2,
      "sectionId": "quality-gates",
      "selectionPolarity": "correct",
      "source": {
        "label": "CodeBuild test reports",
        "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-report.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:concept:1",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:concept:2",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:example:1",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:example:2",
    "kind": "slide",
    "position": 28,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:misconception:1",
    "kind": "slide",
    "position": 29,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:section:failure-regression:takeaway:1",
    "kind": "slide",
    "position": 30,
    "required": true
  },
  {
    "id": "fundamentals.testing-quality:checkpoint:fundamentals.testing-quality.checkpoint.failure-regression.v1",
    "kind": "checkpoint",
    "position": 31,
    "question": {
      "category": "fundamentals.testing-quality",
      "choiceIds": [
        "B",
        "A",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.testing-quality.checkpoint.failure-regression.v1",
      "objectiveId": "testing-4",
      "questionId": "fundamentals.testing-quality.checkpoint.failure-regression.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "failure-regression",
      "selectionPolarity": "correct",
      "source": {
        "label": "Well-Architected change validation",
        "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_test_val_chg.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_10_0$::jsonb,
    $kaq_final_10_0$[
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-testing-001",
    "objectiveId": "testing-1",
    "questionId": "fund-testing-001",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "test-levels",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeBuild test reports",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html"
    },
    "sourceVersion": "2026-11",
    "position": 0
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-testing-002",
    "objectiveId": "testing-1",
    "questionId": "fund-testing-002",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "test-levels",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS CodeBuild test reports",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html"
    },
    "sourceVersion": "2026-11",
    "position": 1
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-testing-003",
    "objectiveId": "testing-1",
    "questionId": "fund-testing-003",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "test-levels",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeBuild test reports",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html"
    },
    "sourceVersion": "2026-11",
    "position": 2
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-testing-004",
    "objectiveId": "testing-2",
    "questionId": "fund-testing-004",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "test-design",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS Well-Architected OPS03-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops03-bp02.html"
    },
    "sourceVersion": "2026-11",
    "position": 3
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B",
      "C"
    ],
    "explanationRef": "final:fund-testing-005",
    "objectiveId": "testing-2",
    "questionId": "fund-testing-005",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "test-design",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Well-Architected OPS03-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops03-bp02.html"
    },
    "sourceVersion": "2026-11",
    "position": 4
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-testing-006",
    "objectiveId": "testing-2",
    "questionId": "fund-testing-006",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "test-design",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS Well-Architected OPS03-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops03-bp02.html"
    },
    "sourceVersion": "2026-11",
    "position": 5
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-testing-007",
    "objectiveId": "testing-3",
    "questionId": "fund-testing-007",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "quality-gates",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeBuild test report statuses",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-report.html"
    },
    "sourceVersion": "2026-11",
    "position": 6
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-testing-008",
    "objectiveId": "testing-3",
    "questionId": "fund-testing-008",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "quality-gates",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Well-Architected OPS05-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_test_val_chg.html"
    },
    "sourceVersion": "2026-11",
    "position": 7
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "C"
    ],
    "explanationRef": "final:fund-testing-009",
    "objectiveId": "testing-3",
    "questionId": "fund-testing-009",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "quality-gates",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS CodeBuild test reports",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-view-reports.html"
    },
    "sourceVersion": "2026-11",
    "position": 8
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-testing-010",
    "objectiveId": "testing-4",
    "questionId": "fund-testing-010",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "failure-regression",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeBuild test report statuses",
      "url": "https://docs.aws.amazon.com/codebuild/latest/userguide/test-report.html"
    },
    "sourceVersion": "2026-11",
    "position": 9
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-testing-011",
    "objectiveId": "testing-4",
    "questionId": "fund-testing-011",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "failure-regression",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Well-Architected OPS03-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops03-bp02.html"
    },
    "sourceVersion": "2026-11",
    "position": 10
  },
  {
    "category": "テスト品質",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "C"
    ],
    "explanationRef": "final:fund-testing-012",
    "objectiveId": "testing-4",
    "questionId": "fund-testing-012",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "failure-regression",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Well-Architected OPS05-BP02",
      "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_test_val_chg.html"
    },
    "sourceVersion": "2026-11",
    "position": 11
  }
]$kaq_final_10_0$::jsonb),
  ('fundamentals.release-rollback', 'aefdb6ac12816dc32b789d54c1bd5e97d063aa81969c39849ffb72e3cc78d663', decode('f05ee29944e3e9e0759ad2a44580b82ef0a0803e1f618b64e93ff772fd27328a', 'hex'),
    $kaq_plan_11_0$[
  {
    "id": "fundamentals.release-rollback:intro:orientation:1",
    "kind": "slide",
    "position": 1,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:intro:objectives:1",
    "kind": "slide",
    "position": 2,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:intro:objectives:2",
    "kind": "slide",
    "position": 3,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:concept:1",
    "kind": "slide",
    "position": 4,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:concept:2",
    "kind": "slide",
    "position": 5,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:example:1",
    "kind": "slide",
    "position": 6,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:example:2",
    "kind": "slide",
    "position": 7,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:misconception:1",
    "kind": "slide",
    "position": 8,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:deployment-strategies:takeaway:1",
    "kind": "slide",
    "position": 9,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:checkpoint:fundamentals.release-rollback.checkpoint.deployment-strategies.v1",
    "kind": "checkpoint",
    "position": 10,
    "question": {
      "category": "fundamentals.release-rollback",
      "choiceIds": [
        "C",
        "A",
        "B",
        "D"
      ],
      "correctChoiceIds": [
        "C"
      ],
      "explanationRef": "checkpoint:fundamentals.release-rollback.checkpoint.deployment-strategies.v1",
      "objectiveId": "release-1",
      "questionId": "fundamentals.release-rollback.checkpoint.deployment-strategies.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "deployment-strategies",
      "selectionPolarity": "correct",
      "source": {
        "label": "CodeDeploy deployment configurations",
        "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:concept:1",
    "kind": "slide",
    "position": 11,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:concept:2",
    "kind": "slide",
    "position": 12,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:example:1",
    "kind": "slide",
    "position": 13,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:example:2",
    "kind": "slide",
    "position": 14,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:misconception:1",
    "kind": "slide",
    "position": 15,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:observation-abort:takeaway:1",
    "kind": "slide",
    "position": 16,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:checkpoint:fundamentals.release-rollback.checkpoint.observation-abort.v1",
    "kind": "checkpoint",
    "position": 17,
    "question": {
      "category": "fundamentals.release-rollback",
      "choiceIds": [
        "D",
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "D"
      ],
      "explanationRef": "checkpoint:fundamentals.release-rollback.checkpoint.observation-abort.v1",
      "objectiveId": "release-2",
      "questionId": "fundamentals.release-rollback.checkpoint.observation-abort.v1",
      "requiredChoices": 1,
      "revision": 2,
      "sectionId": "observation-abort",
      "selectionPolarity": "correct",
      "source": {
        "label": "CodeDeploy advanced deployment options",
        "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups-configure-advanced-options.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:concept:1",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:concept:2",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:example:1",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:example:2",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:misconception:1",
    "kind": "slide",
    "position": 22,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:rollback-recovery:takeaway:1",
    "kind": "slide",
    "position": 23,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:checkpoint:fundamentals.release-rollback.checkpoint.rollback-recovery.v1",
    "kind": "checkpoint",
    "position": 24,
    "question": {
      "category": "fundamentals.release-rollback",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.release-rollback.checkpoint.rollback-recovery.v1",
      "objectiveId": "release-3",
      "questionId": "fundamentals.release-rollback.checkpoint.rollback-recovery.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "rollback-recovery",
      "selectionPolarity": "correct",
      "source": {
        "label": "CodeDeploy rollback and redeploy",
        "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-rollback-and-redeploy.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:concept:1",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:concept:2",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:example:1",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:example:2",
    "kind": "slide",
    "position": 28,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:misconception:1",
    "kind": "slide",
    "position": 29,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:section:database-recovery:takeaway:1",
    "kind": "slide",
    "position": 30,
    "required": true
  },
  {
    "id": "fundamentals.release-rollback:checkpoint:fundamentals.release-rollback.checkpoint.database-recovery.v1",
    "kind": "checkpoint",
    "position": 31,
    "question": {
      "category": "fundamentals.release-rollback",
      "choiceIds": [
        "C",
        "D",
        "A",
        "B"
      ],
      "correctChoiceIds": [
        "C",
        "D"
      ],
      "explanationRef": "checkpoint:fundamentals.release-rollback.checkpoint.database-recovery.v1",
      "objectiveId": "release-4",
      "questionId": "fundamentals.release-rollback.checkpoint.database-recovery.v1",
      "requiredChoices": 2,
      "revision": 1,
      "sectionId": "database-recovery",
      "selectionPolarity": "correct",
      "source": {
        "label": "AWS Blue/Green Deployments whitepaper",
        "url": "https://docs.aws.amazon.com/pdfs/whitepapers/latest/blue-green-deployments/blue-green-deployments.pdf"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_11_0$::jsonb,
    $kaq_final_11_0$[
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-release-001",
    "objectiveId": "release-1",
    "questionId": "fund-release-001",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "deployment-strategies",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon ECS deployment strategies",
      "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html"
    },
    "sourceVersion": "2026-11",
    "position": 0
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-release-002",
    "objectiveId": "release-1",
    "questionId": "fund-release-002",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "deployment-strategies",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS deployment strategies whitepaper",
      "url": "https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/deployment-strategies.html"
    },
    "sourceVersion": "2026-11",
    "position": 1
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-release-003",
    "objectiveId": "release-1",
    "questionId": "fund-release-003",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "deployment-strategies",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon ECS deployment strategies",
      "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html"
    },
    "sourceVersion": "2026-11",
    "position": 2
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-release-004",
    "objectiveId": "release-2",
    "questionId": "fund-release-004",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "observation-abort",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeDeploy deployment monitoring",
      "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups-configure-advanced-options.html"
    },
    "sourceVersion": "2026-11",
    "position": 3
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B",
      "C"
    ],
    "explanationRef": "final:fund-release-005",
    "objectiveId": "release-2",
    "questionId": "fund-release-005",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "observation-abort",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Well-Architected safe deployment",
      "url": "https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/ops_mit_deploy_risks_deploy_mgmt_sys.html"
    },
    "sourceVersion": "2026-11",
    "position": 4
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "E"
    ],
    "explanationRef": "final:fund-release-006",
    "objectiveId": "release-2",
    "questionId": "fund-release-006",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "observation-abort",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS CodeDeploy deployment monitoring",
      "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups-configure-advanced-options.html"
    },
    "sourceVersion": "2026-11",
    "position": 5
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-release-007",
    "objectiveId": "release-3",
    "questionId": "fund-release-007",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "rollback-recovery",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeDeploy rollback and redeploy",
      "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-rollback-and-redeploy.html"
    },
    "sourceVersion": "2026-11",
    "position": 6
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-release-008",
    "objectiveId": "release-3",
    "questionId": "fund-release-008",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "rollback-recovery",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS CodeDeploy rollback and redeploy",
      "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-rollback-and-redeploy.html"
    },
    "sourceVersion": "2026-11",
    "position": 7
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-release-009",
    "objectiveId": "release-3",
    "questionId": "fund-release-009",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "rollback-recovery",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS CodeDeploy rollback and redeploy",
      "url": "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-rollback-and-redeploy.html"
    },
    "sourceVersion": "2026-11",
    "position": 8
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-release-010",
    "objectiveId": "release-4",
    "questionId": "fund-release-010",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "database-recovery",
    "selectionPolarity": "correct",
    "source": {
      "label": "AWS Prescriptive Guidance schema changes",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/blue-green-deployments/schema-changes.html"
    },
    "sourceVersion": "2026-11",
    "position": 9
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-release-011",
    "objectiveId": "release-4",
    "questionId": "fund-release-011",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "database-recovery",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Prescriptive Guidance schema changes",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/blue-green-deployments/schema-changes.html"
    },
    "sourceVersion": "2026-11",
    "position": 10
  },
  {
    "category": "デプロイ復旧",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "E"
    ],
    "explanationRef": "final:fund-release-012",
    "objectiveId": "release-4",
    "questionId": "fund-release-012",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "database-recovery",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "AWS Prescriptive Guidance schema changes",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/blue-green-deployments/schema-changes.html"
    },
    "sourceVersion": "2026-11",
    "position": 11
  }
]$kaq_final_11_0$::jsonb),
  ('fundamentals.observability', 'c79e510b8f8d4c0e3fb5fd46b7564ac778cb9bc6bac91349cc3efdfc9720cbf0', decode('c1810c820eb145cbf8d5b6527a9fb132d582e6c7549a3599158b94fba6edd012', 'hex'),
    $kaq_plan_12_0$[
  {
    "id": "fundamentals.observability:intro:orientation:1",
    "kind": "slide",
    "position": 1,
    "required": true
  },
  {
    "id": "fundamentals.observability:intro:objectives:1",
    "kind": "slide",
    "position": 2,
    "required": true
  },
  {
    "id": "fundamentals.observability:intro:objectives:2",
    "kind": "slide",
    "position": 3,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:concept:1",
    "kind": "slide",
    "position": 4,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:concept:2",
    "kind": "slide",
    "position": 5,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:example:1",
    "kind": "slide",
    "position": 6,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:example:2",
    "kind": "slide",
    "position": 7,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:misconception:1",
    "kind": "slide",
    "position": 8,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:signals:takeaway:1",
    "kind": "slide",
    "position": 9,
    "required": true
  },
  {
    "id": "fundamentals.observability:checkpoint:fundamentals.observability.checkpoint.signals.v1",
    "kind": "checkpoint",
    "position": 10,
    "question": {
      "category": "fundamentals.observability",
      "choiceIds": [
        "B",
        "A",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.observability.checkpoint.signals.v1",
      "objectiveId": "signals",
      "questionId": "fundamentals.observability.checkpoint.signals.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "signals",
      "selectionPolarity": "correct",
      "source": {
        "label": "CloudWatch metrics",
        "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:concept:1",
    "kind": "slide",
    "position": 11,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:concept:2",
    "kind": "slide",
    "position": 12,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:example:1",
    "kind": "slide",
    "position": 13,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:example:2",
    "kind": "slide",
    "position": 14,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:misconception:1",
    "kind": "slide",
    "position": 15,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:golden-signals:takeaway:1",
    "kind": "slide",
    "position": 16,
    "required": true
  },
  {
    "id": "fundamentals.observability:checkpoint:fundamentals.observability.checkpoint.golden-signals.v1",
    "kind": "checkpoint",
    "position": 17,
    "question": {
      "category": "fundamentals.observability",
      "choiceIds": [
        "D",
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "D",
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.observability.checkpoint.golden-signals.v1",
      "objectiveId": "golden-signals",
      "questionId": "fundamentals.observability.checkpoint.golden-signals.v1",
      "requiredChoices": 2,
      "revision": 1,
      "sectionId": "golden-signals",
      "selectionPolarity": "correct",
      "source": {
        "label": "Google SRE golden signals",
        "url": "https://sre.google/sre-book/monitoring-distributed-systems/"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:concept:1",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:concept:2",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:example:1",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:example:2",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:misconception:1",
    "kind": "slide",
    "position": 22,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:objectives:takeaway:1",
    "kind": "slide",
    "position": 23,
    "required": true
  },
  {
    "id": "fundamentals.observability:checkpoint:fundamentals.observability.checkpoint.objectives.v1",
    "kind": "checkpoint",
    "position": 24,
    "question": {
      "category": "fundamentals.observability",
      "choiceIds": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A",
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.observability.checkpoint.objectives.v1",
      "objectiveId": "objectives",
      "questionId": "fundamentals.observability.checkpoint.objectives.v1",
      "requiredChoices": 2,
      "revision": 2,
      "sectionId": "objectives",
      "selectionPolarity": "correct",
      "source": {
        "label": "CloudWatch Service Level Objectives",
        "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.observability:section:improvement:concept:1",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:improvement:example:1",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:improvement:example:2",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:improvement:misconception:1",
    "kind": "slide",
    "position": 28,
    "required": true
  },
  {
    "id": "fundamentals.observability:section:improvement:takeaway:1",
    "kind": "slide",
    "position": 29,
    "required": true
  },
  {
    "id": "fundamentals.observability:checkpoint:fundamentals.observability.checkpoint.improvement.v1",
    "kind": "checkpoint",
    "position": 30,
    "question": {
      "category": "fundamentals.observability",
      "choiceIds": [
        "C",
        "A",
        "B",
        "D"
      ],
      "correctChoiceIds": [
        "C"
      ],
      "explanationRef": "checkpoint:fundamentals.observability.checkpoint.improvement.v1",
      "objectiveId": "improvement",
      "questionId": "fundamentals.observability.checkpoint.improvement.v1",
      "requiredChoices": 1,
      "revision": 1,
      "sectionId": "improvement",
      "selectionPolarity": "correct",
      "source": {
        "label": "SRE effective troubleshooting",
        "url": "https://sre.google/sre-book/effective-troubleshooting/"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_12_0$::jsonb,
    $kaq_final_12_0$[
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-observe-101",
    "objectiveId": "signals",
    "questionId": "fund-observe-101",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "signals",
    "selectionPolarity": "correct",
    "source": {
      "label": "Amazon CloudWatch metrics",
      "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 0
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-observe-102",
    "objectiveId": "signals",
    "questionId": "fund-observe-102",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "signals",
    "selectionPolarity": "correct",
    "source": {
      "label": "What is AWS X-Ray?",
      "url": "https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 1
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-observe-103",
    "objectiveId": "signals",
    "questionId": "fund-observe-103",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "signals",
    "selectionPolarity": "correct",
    "source": {
      "label": "What is Amazon CloudWatch Logs?",
      "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 2
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "D"
    ],
    "explanationRef": "final:fund-observe-104",
    "objectiveId": "golden-signals",
    "questionId": "fund-observe-104",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "golden-signals",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Google SRE: Monitoring Distributed Systems",
      "url": "https://sre.google/sre-book/monitoring-distributed-systems/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 3
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A"
    ],
    "explanationRef": "final:fund-observe-105",
    "objectiveId": "golden-signals",
    "questionId": "fund-observe-105",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "golden-signals",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Google SRE: Effective Troubleshooting",
      "url": "https://sre.google/sre-book/effective-troubleshooting/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 4
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "E"
    ],
    "explanationRef": "final:fund-observe-106",
    "objectiveId": "golden-signals",
    "questionId": "fund-observe-106",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "golden-signals",
    "selectionPolarity": "correct",
    "source": {
      "label": "Google SRE: Monitoring Distributed Systems",
      "url": "https://sre.google/sre-book/monitoring-distributed-systems/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 5
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "A",
      "B"
    ],
    "explanationRef": "final:fund-observe-107",
    "objectiveId": "objectives",
    "questionId": "fund-observe-107",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "objectives",
    "selectionPolarity": "correct",
    "source": {
      "label": "CloudWatch service level objectives",
      "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 6
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-observe-108",
    "objectiveId": "objectives",
    "questionId": "fund-observe-108",
    "requiredChoices": 1,
    "revision": 1,
    "sectionId": "objectives",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "CloudWatch service level objectives",
      "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 7
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-observe-109",
    "objectiveId": "objectives",
    "questionId": "fund-observe-109",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "objectives",
    "selectionPolarity": "correct",
    "source": {
      "label": "CloudWatch service level objectives",
      "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html"
    },
    "sourceVersion": "2026-11-learning",
    "position": 8
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "B",
      "E"
    ],
    "explanationRef": "final:fund-observe-110",
    "objectiveId": "improvement",
    "questionId": "fund-observe-110",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "improvement",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Google SRE: Effective Troubleshooting",
      "url": "https://sre.google/sre-book/effective-troubleshooting/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 9
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "A",
      "D"
    ],
    "explanationRef": "final:fund-observe-111",
    "objectiveId": "improvement",
    "questionId": "fund-observe-111",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "improvement",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Google SRE: Effective Troubleshooting",
      "url": "https://sre.google/sre-book/effective-troubleshooting/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 10
  },
  {
    "category": "監視と改善",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "correctChoiceIds": [
      "C",
      "E"
    ],
    "explanationRef": "final:fund-observe-112",
    "objectiveId": "improvement",
    "questionId": "fund-observe-112",
    "requiredChoices": 2,
    "revision": 1,
    "sectionId": "improvement",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Google SRE: Effective Troubleshooting",
      "url": "https://sre.google/sre-book/effective-troubleshooting/"
    },
    "sourceVersion": "2026-11-learning",
    "position": 11
  }
]$kaq_final_12_0$::jsonb)
;

commit;
