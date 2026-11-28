-- Generated from public/fundamentals/delivery/trustedCatalog.json. Do not edit manually.
-- The hash is Node canonical JSON SHA-256, stored as decode(hex, 'hex').
begin;

insert into public.published_fundamentals_catalogs (
  unit_id, content_version, content_hash, plan, final_questions
) values
  ('fundamentals.routing-connectivity', '92ad755a33634da8e7be53d892345bc0260fdfdb4f15e87e90e3a1ea2ed56a7b', decode('3ecef9bdaa863eb7887d4f2402a608d6c82a816a2c500e163f91ed81cb9937b8', 'hex'),
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
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.route-selection.v1",
      "objectiveId": "route-1",
      "questionId": "fundamentals.routing-connectivity.checkpoint.route-selection.v1",
      "requiredChoices": 1,
      "revision": 2,
      "sectionId": "route-selection",
      "selectionPolarity": "correct",
      "source": {
        "label": "Subnet route tables",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html"
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
        "A",
        "B",
        "C",
        "D"
      ],
      "correctChoiceIds": [
        "A",
        "B"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.internet-egress.v1",
      "objectiveId": "route-2",
      "questionId": "fundamentals.routing-connectivity.checkpoint.internet-egress.v1",
      "requiredChoices": 2,
      "revision": 2,
      "sectionId": "internet-egress",
      "selectionPolarity": "correct",
      "source": {
        "label": "Example routing options",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html"
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
    "id": "fundamentals.routing-connectivity:section:traffic-controls:example:1",
    "kind": "slide",
    "position": 18,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:example:2",
    "kind": "slide",
    "position": 19,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:misconception:1",
    "kind": "slide",
    "position": 20,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:traffic-controls:takeaway:1",
    "kind": "slide",
    "position": 21,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
    "kind": "checkpoint",
    "position": 22,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
      "objectiveId": "route-3",
      "questionId": "fundamentals.routing-connectivity.checkpoint.traffic-controls.v1",
      "requiredChoices": 1,
      "revision": 2,
      "sectionId": "traffic-controls",
      "selectionPolarity": "correct",
      "source": {
        "label": "Network ACLs",
        "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:concept:1",
    "kind": "slide",
    "position": 23,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:example:1",
    "kind": "slide",
    "position": 24,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:example:2",
    "kind": "slide",
    "position": 25,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:misconception:1",
    "kind": "slide",
    "position": 26,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:section:private-paths:takeaway:1",
    "kind": "slide",
    "position": 27,
    "required": true
  },
  {
    "id": "fundamentals.routing-connectivity:checkpoint:fundamentals.routing-connectivity.checkpoint.private-paths.v1",
    "kind": "checkpoint",
    "position": 28,
    "question": {
      "category": "fundamentals.routing-connectivity",
      "choiceIds": [
        "A",
        "B",
        "C"
      ],
      "correctChoiceIds": [
        "A"
      ],
      "explanationRef": "checkpoint:fundamentals.routing-connectivity.checkpoint.private-paths.v1",
      "objectiveId": "route-4",
      "questionId": "fundamentals.routing-connectivity.checkpoint.private-paths.v1",
      "requiredChoices": 1,
      "revision": 2,
      "sectionId": "private-paths",
      "selectionPolarity": "correct",
      "source": {
        "label": "VPC peering connections",
        "url": "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html"
      },
      "sourceVersion": "2026-11-learning"
    },
    "required": true
  }
]$kaq_plan_8_0$::jsonb,
    $kaq_final_8_0$[
  {
    "category": "fundamentals.routing-connectivity",
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
    "revision": 2,
    "sectionId": "route-selection",
    "selectionPolarity": "correct",
    "source": {
      "label": "Configure route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 0
  },
  {
    "category": "fundamentals.routing-connectivity",
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
    "revision": 2,
    "sectionId": "route-selection",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Subnet route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 1
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-route-003",
    "objectiveId": "route-1",
    "questionId": "fund-route-003",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "route-selection",
    "selectionPolarity": "correct",
    "source": {
      "label": "VPC peering connections",
      "url": "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 2
  },
  {
    "category": "fundamentals.routing-connectivity",
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
    "revision": 2,
    "sectionId": "internet-egress",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Subnet route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 3
  },
  {
    "category": "fundamentals.routing-connectivity",
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
    "revision": 2,
    "sectionId": "internet-egress",
    "selectionPolarity": "correct",
    "source": {
      "label": "Example routing options",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 4
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "C"
    ],
    "explanationRef": "final:fund-route-006",
    "objectiveId": "route-2",
    "questionId": "fund-route-006",
    "requiredChoices": 1,
    "revision": 2,
    "sectionId": "internet-egress",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "NAT ゲートウェイのトラブルシューティング",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-troubleshooting.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 5
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-route-007",
    "objectiveId": "route-3",
    "questionId": "fund-route-007",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "traffic-controls",
    "selectionPolarity": "correct",
    "source": {
      "label": "Network ACLs",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 6
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "B",
      "D"
    ],
    "explanationRef": "final:fund-route-008",
    "objectiveId": "route-3",
    "questionId": "fund-route-008",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "traffic-controls",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "Network ACLs",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 7
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C"
    ],
    "correctChoiceIds": [
      "B"
    ],
    "explanationRef": "final:fund-route-009",
    "objectiveId": "route-3",
    "questionId": "fund-route-009",
    "requiredChoices": 1,
    "revision": 2,
    "sectionId": "traffic-controls",
    "selectionPolarity": "correct",
    "source": {
      "label": "Configure route tables",
      "url": "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 8
  },
  {
    "category": "fundamentals.routing-connectivity",
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
    "revision": 2,
    "sectionId": "private-paths",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "VPC endpoints",
      "url": "https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 9
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "A",
      "C"
    ],
    "explanationRef": "final:fund-route-011",
    "objectiveId": "route-4",
    "questionId": "fund-route-011",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "private-paths",
    "selectionPolarity": "correct",
    "source": {
      "label": "VPC peering connections",
      "url": "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 10
  },
  {
    "category": "fundamentals.routing-connectivity",
    "choiceIds": [
      "A",
      "B",
      "C",
      "D"
    ],
    "correctChoiceIds": [
      "B",
      "D"
    ],
    "explanationRef": "final:fund-route-012",
    "objectiveId": "route-4",
    "questionId": "fund-route-012",
    "requiredChoices": 2,
    "revision": 2,
    "sectionId": "private-paths",
    "selectionPolarity": "incorrect",
    "source": {
      "label": "VPC endpoints",
      "url": "https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html"
    },
    "sourceVersion": "2026-11-rebuild",
    "position": 11
  }
]$kaq_final_8_0$::jsonb)
;

commit;
