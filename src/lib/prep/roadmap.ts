export type PrepTaskKind = "recall" | "learn" | "practice" | "review" | "mock" | "interview";
export type PrepTaskStatus = "not_started" | "review" | "completed";

export type PrepProblem = {
  title: string;
  url: string;
};

export type PrepTask = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  kind: PrepTaskKind;
  resourceUrl?: string;
  resourceLabel?: string;
  problems?: PrepProblem[];
};

export type PrepDay = {
  day: number;
  week: 1 | 2 | 3;
  focus: string;
  outcome: string;
  tasks: PrepTask[];
};

type DayDefinition = {
  focus: string;
  outcome: string;
  lessonUrl: string;
  problems: Array<[title: string, slug: string]>;
  recall: string;
  interview?: string;
};

const NEETCODE_ROADMAP = "https://neetcode.io/roadmap";
const LEETCODE_PROBLEMS = "https://leetcode.com/problems";

const DAYS: DayDefinition[] = [
  {
    focus: "Arrays & hashing",
    outcome: "Recognize when a set, frequency map, or value-to-index map removes a nested loop.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Write Python dict, set, Counter, sorting, and enumerate patterns from memory.",
    problems: [
      ["Contains Duplicate", "contains-duplicate"],
      ["Valid Anagram", "valid-anagram"],
      ["Two Sum", "two-sum"],
      ["Group Anagrams", "group-anagrams"],
      ["Top K Frequent Elements", "top-k-frequent-elements"],
    ],
  },
  {
    focus: "Two pointers",
    outcome: "Explain the invariant that makes two pointers correct before writing code.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo Two Sum and Group Anagrams without notes; state both complexities aloud.",
    problems: [
      ["Valid Palindrome", "valid-palindrome"],
      ["Two Sum II", "two-sum-ii-input-array-is-sorted"],
      ["3Sum", "3sum"],
      ["Container With Most Water", "container-with-most-water"],
    ],
  },
  {
    focus: "Sliding window",
    outcome: "Distinguish fixed and variable windows and identify what makes a window valid.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo yesterday's hardest two-pointer problem and narrate the invariant.",
    problems: [
      ["Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock"],
      ["Longest Substring Without Repeating Characters", "longest-substring-without-repeating-characters"],
      ["Longest Repeating Character Replacement", "longest-repeating-character-replacement"],
      ["Permutation in String", "permutation-in-string"],
    ],
  },
  {
    focus: "Stack",
    outcome: "Spot matching, monotonic-stack, and expression-evaluation problems.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo Longest Substring Without Repeating Characters in 20 minutes.",
    problems: [
      ["Valid Parentheses", "valid-parentheses"],
      ["Min Stack", "min-stack"],
      ["Evaluate Reverse Polish Notation", "evaluate-reverse-polish-notation"],
      ["Daily Temperatures", "daily-temperatures"],
    ],
  },
  {
    focus: "Binary search",
    outcome: "Define the search space, monotonic condition, and boundary behavior explicitly.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Rebuild a monotonic stack for Daily Temperatures without looking at code.",
    problems: [
      ["Binary Search", "binary-search"],
      ["Search a 2D Matrix", "search-a-2d-matrix"],
      ["Find Minimum in Rotated Sorted Array", "find-minimum-in-rotated-sorted-array"],
      ["Search in Rotated Sorted Array", "search-in-rotated-sorted-array"],
    ],
  },
  {
    focus: "Linked lists",
    outcome: "Manipulate pointers safely and use dummy, slow, and fast pointers intentionally.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Write iterative binary search with correct boundaries from memory.",
    interview: "Prepare a two-minute project overview: problem, ownership, technical decision, and measurable result.",
    problems: [
      ["Reverse Linked List", "reverse-linked-list"],
      ["Merge Two Sorted Lists", "merge-two-sorted-lists"],
      ["Linked List Cycle", "linked-list-cycle"],
      ["Reorder List", "reorder-list"],
    ],
  },
  {
    focus: "Week 1 consolidation",
    outcome: "Complete two unseen questions under OA constraints and turn mistakes into a review queue.",
    lessonUrl: "https://leetcode.com/assessment/",
    recall: "Warm up by redoing one sliding-window and one binary-search miss.",
    problems: [],
  },
  {
    focus: "Trees: traversal",
    outcome: "Write recursive DFS, iterative DFS, and BFS without relying on a template.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo two Week 1 questions marked for review.",
    problems: [
      ["Invert Binary Tree", "invert-binary-tree"],
      ["Maximum Depth of Binary Tree", "maximum-depth-of-binary-tree"],
      ["Diameter of Binary Tree", "diameter-of-binary-tree"],
      ["Binary Tree Level Order Traversal", "binary-tree-level-order-traversal"],
    ],
  },
  {
    focus: "Trees: BST and recursion",
    outcome: "Use subtree return values and BST ordering properties instead of global state.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Code BFS and recursive DFS from a blank editor, then compare tradeoffs.",
    problems: [
      ["Same Tree", "same-tree"],
      ["Subtree of Another Tree", "subtree-of-another-tree"],
      ["Validate Binary Search Tree", "validate-binary-search-tree"],
      ["Kth Smallest Element in a BST", "kth-smallest-element-in-a-bst"],
    ],
  },
  {
    focus: "Heap / priority queue",
    outcome: "Choose a heap for streaming top-k and repeated best-candidate operations.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo the hardest tree problem from Days 8–9 without notes.",
    problems: [
      ["Kth Largest Element in a Stream", "kth-largest-element-in-a-stream"],
      ["Last Stone Weight", "last-stone-weight"],
      ["K Closest Points to Origin", "k-closest-points-to-origin"],
      ["Task Scheduler", "task-scheduler"],
    ],
  },
  {
    focus: "Backtracking",
    outcome: "Define the decision tree, base case, and state cleanup before implementation.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Implement top-k with a heap and explain when sorting is acceptable instead.",
    problems: [
      ["Subsets", "subsets"],
      ["Combination Sum", "combination-sum"],
      ["Permutations", "permutations"],
      ["Word Search", "word-search"],
    ],
  },
  {
    focus: "Graphs: BFS and DFS",
    outcome: "Model grid and adjacency-list problems and track visited state correctly.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Generate Subsets and Permutations from memory; identify the state that changes.",
    problems: [
      ["Number of Islands", "number-of-islands"],
      ["Clone Graph", "clone-graph"],
      ["Max Area of Island", "max-area-of-island"],
      ["Rotting Oranges", "rotting-oranges"],
    ],
  },
  {
    focus: "Graphs: dependencies",
    outcome: "Recognize cycle detection, topological ordering, and connected components.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Solve Number of Islands once with BFS and once with DFS.",
    interview: "Build two STAR stories: one failure and one disagreement. Include your action and measurable result.",
    problems: [
      ["Course Schedule", "course-schedule"],
      ["Course Schedule II", "course-schedule-ii"],
      ["Graph Valid Tree", "graph-valid-tree"],
      ["Number of Connected Components", "number-of-connected-components-in-an-undirected-graph"],
    ],
  },
  {
    focus: "Week 2 consolidation",
    outcome: "Complete a mixed two-question OA and communicate solutions without an IDE.",
    lessonUrl: "https://leetcode.com/assessment/",
    recall: "Redo one tree and one graph question marked for review.",
    problems: [],
  },
  {
    focus: "Intervals",
    outcome: "Sort by the correct boundary and reason about overlap before coding.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo the graph problem that produced the most implementation errors.",
    problems: [
      ["Insert Interval", "insert-interval"],
      ["Merge Intervals", "merge-intervals"],
      ["Non-overlapping Intervals", "non-overlapping-intervals"],
      ["Minimum Number of Arrows", "minimum-number-of-arrows-to-burst-balloons"],
    ],
  },
  {
    focus: "Greedy",
    outcome: "State the local choice and justify why it cannot make the global result worse.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo Merge Intervals and explain the sort key and merge condition.",
    problems: [
      ["Maximum Subarray", "maximum-subarray"],
      ["Jump Game", "jump-game"],
      ["Gas Station", "gas-station"],
      ["Partition Labels", "partition-labels"],
    ],
  },
  {
    focus: "1-D dynamic programming",
    outcome: "Define state, recurrence, base cases, and evaluation order before implementation.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Redo Jump Game and contrast the greedy and DP formulations.",
    problems: [
      ["Climbing Stairs", "climbing-stairs"],
      ["Min Cost Climbing Stairs", "min-cost-climbing-stairs"],
      ["House Robber", "house-robber"],
      ["Coin Change", "coin-change"],
    ],
  },
  {
    focus: "DP: sequences and decisions",
    outcome: "Translate a recursive choice into a memoized or bottom-up solution.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Derive House Robber and Coin Change recurrences without code.",
    problems: [
      ["Word Break", "word-break"],
      ["Longest Increasing Subsequence", "longest-increasing-subsequence"],
      ["Partition Equal Subset Sum", "partition-equal-subset-sum"],
      ["Decode Ways", "decode-ways"],
    ],
  },
  {
    focus: "Mixed interview set",
    outcome: "Switch between patterns quickly and communicate assumptions, tests, and complexity.",
    lessonUrl: "https://leetcode.com/problemset/",
    recall: "Select and redo one miss each from trees, graphs, and DP.",
    problems: [
      ["Product of Array Except Self", "product-of-array-except-self"],
      ["Lowest Common Ancestor of a Binary Tree", "lowest-common-ancestor-of-a-binary-tree"],
      ["Network Delay Time", "network-delay-time"],
    ],
  },
  {
    focus: "Weak-area repair",
    outcome: "Turn the two lowest-confidence patterns into repeatable procedures.",
    lessonUrl: NEETCODE_ROADMAP,
    recall: "Rank every topic by independent solve rate and choose the bottom two.",
    interview: "Record a five-minute project deep dive covering architecture, tradeoffs, testing, failure, and next improvement.",
    problems: [],
  },
  {
    focus: "Final OA simulation",
    outcome: "Execute a full OA routine: clarify, solve, test edge cases, and manage time.",
    lessonUrl: "https://leetcode.com/assessment/",
    recall: "Warm up with one familiar medium in 25 minutes, including tests and complexity.",
    problems: [],
  },
];

function problem(title: string, slug: string): PrepProblem {
  return { title, url: `${LEETCODE_PROBLEMS}/${slug}/` };
}

function buildTasks(definition: DayDefinition, day: number): PrepTask[] {
  const tasks: PrepTask[] = [
    {
      id: `day-${day}-recall`,
      title: "Closed-book recall",
      description: definition.recall,
      minutes: 45,
      kind: "recall",
    },
  ];

  if (definition.problems.length > 0) {
    tasks.push(
      {
        id: `day-${day}-learn`,
        title: `Learn the ${definition.focus} pattern`,
        description: "Study the pattern, then close the explanation and implement the core idea from memory.",
        minutes: 60,
        kind: "learn",
        resourceUrl: definition.lessonUrl,
        resourceLabel: "Open NeetCode roadmap",
      },
      {
        id: `day-${day}-practice`,
        title: "Timed LeetCode set",
        description: "Cap easy questions at 20 minutes and medium questions at 35 minutes. Use a hint before a full solution.",
        minutes: definition.interview ? 120 : 150,
        kind: "practice",
        problems: definition.problems.map(([title, slug]) => problem(title, slug)),
      },
    );
  } else if (day === 20) {
    tasks.push(
      {
        id: `day-${day}-diagnose`,
        title: "Diagnose the bottom two patterns",
        description: "Use your review queue to measure independent solve rate, implementation errors, and time-to-pattern.",
        minutes: 60,
        kind: "review",
      },
      {
        id: `day-${day}-repair`,
        title: "Targeted repair set",
        description: "For each weak pattern, redo two misses and solve one unseen medium without assistance.",
        minutes: definition.interview ? 120 : 150,
        kind: "practice",
        resourceUrl: definition.lessonUrl,
        resourceLabel: "Open NeetCode roadmap",
      },
    );
  } else {
    tasks.push(
      {
        id: `day-${day}-mock`,
        title: "Full timed mock OA",
        description: "Solve two unseen questions in 70–90 minutes. No videos, solution tabs, or autocomplete.",
        minutes: 90,
        kind: "mock",
        resourceUrl: definition.lessonUrl,
        resourceLabel: "Open assessment practice",
      },
      {
        id: `day-${day}-postmortem`,
        title: "OA postmortem and repair",
        description: "Finish any incomplete solution, add edge cases, then re-code the clean solution from a blank editor.",
        minutes: 120,
        kind: "review",
      },
    );
  }

  tasks.push({
    id: `day-${day}-debrief`,
    title: "Complexity and mistake log",
    description: "Record the pattern signal, first wrong approach, edge cases, and next review date for every miss.",
    minutes: 30,
    kind: "review",
  });

  if (definition.interview) {
    tasks.push({
      id: `day-${day}-interview`,
      title: "Interview communication",
      description: definition.interview,
      minutes: 30,
      kind: "interview",
    });
  }

  return tasks;
}

export const PREP_ROADMAP: PrepDay[] = DAYS.map((definition, index) => {
  const day = index + 1;
  return {
    day,
    week: Math.ceil(day / 7) as 1 | 2 | 3,
    focus: definition.focus,
    outcome: definition.outcome,
    tasks: buildTasks(definition, day),
  };
});

export const PREP_TOTAL_MINUTES = PREP_ROADMAP.reduce(
  (total, day) => total + day.tasks.reduce((dayTotal, task) => dayTotal + task.minutes, 0),
  0,
);

export const PREP_TASK_COUNT = PREP_ROADMAP.reduce(
  (total, day) => total + day.tasks.length,
  0,
);
