-- Manual spot-check seed for local dev, independent of the full dataset import.
-- The full dataset is loaded via ../setup/dataset.py (newfacade/LeetCodeDataset on Hugging Face).
-- Contains 6 Easy + 3 Medium problems. Safe to re-run (upserts on task_id).
\c code_service

INSERT INTO problems (
  task_id, question_id, difficulty, tags, problem_description, starter_code, entry_point, input_output, prompt, test
) VALUES
-- ===================== EASY =====================
(
  'two-sum',
  1,
  'Easy',
  ARRAY['Array', 'Hash Table'],
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  'class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass',
  'Solution().twoSum',
  '{
    "inputs": ["nums = [2,7,11,15], target = 9", "nums = [3,2,4], target = 6", "nums = [3,3], target = 6"],
    "outputs": ["[0,1]", "[1,2]", "[0,1]"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n',
  'def check(candidate):\n    assert candidate(nums = [2,7,11,15], target = 9) == [0,1]\n    assert candidate(nums = [3,2,4], target = 6) == [1,2]\n    assert candidate(nums = [3,3], target = 6) == [0,1]'
),
(
  'valid-parentheses',
  20,
  'Easy',
  ARRAY['String', 'Stack'],
  'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets, open brackets are closed in the correct order, and every close bracket has a corresponding open bracket of the same type.',
  'class Solution:\n    def isValid(self, s: str) -> bool:\n        pass',
  'Solution().isValid',
  '{
    "inputs": ["s = \"()\"", "s = \"()[]{}\"", "s = \"(]\""],
    "outputs": ["true", "true", "false"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def isValid(self, s: str) -> bool:\n',
  'def check(candidate):\n    assert candidate(s = "()") == True\n    assert candidate(s = "()[]{}") == True\n    assert candidate(s = "(]") == False'
),
(
  'best-time-to-buy-and-sell-stock',
  121,
  'Easy',
  ARRAY['Array', 'Dynamic Programming'],
  'You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.',
  'class Solution:\n    def maxProfit(self, prices: List[int]) -> int:\n        pass',
  'Solution().maxProfit',
  '{
    "inputs": ["prices = [7,1,5,3,6,4]", "prices = [7,6,4,3,1]"],
    "outputs": ["5", "0"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def maxProfit(self, prices: List[int]) -> int:\n',
  'def check(candidate):\n    assert candidate(prices = [7,1,5,3,6,4]) == 5\n    assert candidate(prices = [7,6,4,3,1]) == 0'
),
(
  'palindrome-number',
  9,
  'Easy',
  ARRAY['Math'],
  'Given an integer x, return true if x reads the same forwards and backwards, and false otherwise.',
  'class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        pass',
  'Solution().isPalindrome',
  '{
    "inputs": ["x = 121", "x = -121", "x = 10"],
    "outputs": ["true", "false", "false"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def isPalindrome(self, x: int) -> bool:\n',
  'def check(candidate):\n    assert candidate(x = 121) == True\n    assert candidate(x = -121) == False\n    assert candidate(x = 10) == False'
),
(
  'roman-to-integer',
  13,
  'Easy',
  ARRAY['Hash Table', 'Math', 'String'],
  'Roman numerals use the symbols I (1), V (5), X (10), L (50), C (100), D (500) and M (1000). Symbols are usually written largest to smallest from left to right, except that a smaller symbol placed before a larger one is subtracted (IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900). Given a valid roman numeral string s, convert it to an integer.',
  'class Solution:\n    def romanToInt(self, s: str) -> int:\n        pass',
  'Solution().romanToInt',
  '{
    "inputs": ["s = \"III\"", "s = \"LVIII\"", "s = \"MCMXCIV\""],
    "outputs": ["3", "58", "1994"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def romanToInt(self, s: str) -> int:\n',
  'def check(candidate):\n    assert candidate(s = "III") == 3\n    assert candidate(s = "LVIII") == 58\n    assert candidate(s = "MCMXCIV") == 1994'
),
(
  'climbing-stairs',
  70,
  'Easy',
  ARRAY['Math', 'Dynamic Programming', 'Memoization'],
  'You are climbing a staircase that takes n steps to reach the top. Each time you can climb either 1 or 2 steps. Return the number of distinct ways you can climb to the top.',
  'class Solution:\n    def climbStairs(self, n: int) -> int:\n        pass',
  'Solution().climbStairs',
  '{
    "inputs": ["n = 2", "n = 3", "n = 5"],
    "outputs": ["2", "3", "8"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def climbStairs(self, n: int) -> int:\n',
  'def check(candidate):\n    assert candidate(n = 2) == 2\n    assert candidate(n = 3) == 3\n    assert candidate(n = 5) == 8'
),
-- ===================== MEDIUM =====================
(
  'longest-substring-without-repeating-characters',
  3,
  'Medium',
  ARRAY['Hash Table', 'String', 'Sliding Window'],
  'Given a string s, return the length of the longest substring that contains no repeated characters.',
  'class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        pass',
  'Solution().lengthOfLongestSubstring',
  '{
    "inputs": ["s = \"abcabcbb\"", "s = \"bbbbb\"", "s = \"pwwkew\""],
    "outputs": ["3", "1", "3"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n',
  'def check(candidate):\n    assert candidate(s = "abcabcbb") == 3\n    assert candidate(s = "bbbbb") == 1\n    assert candidate(s = "pwwkew") == 3'
),
(
  'container-with-most-water',
  11,
  'Medium',
  ARRAY['Array', 'Two Pointers', 'Greedy'],
  'You are given an integer array height of length n, where height[i] is the height of a vertical line drawn at position i. Choose two lines that, together with the x-axis, form a container holding the most water. Return the maximum amount of water the container can store. The container may not be slanted.',
  'class Solution:\n    def maxArea(self, height: List[int]) -> int:\n        pass',
  'Solution().maxArea',
  '{
    "inputs": ["height = [1,8,6,2,5,4,8,3,7]", "height = [1,1]"],
    "outputs": ["49", "1"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def maxArea(self, height: List[int]) -> int:\n',
  'def check(candidate):\n    assert candidate(height = [1,8,6,2,5,4,8,3,7]) == 49\n    assert candidate(height = [1,1]) == 1'
),
(
  'product-of-array-except-self',
  238,
  'Medium',
  ARRAY['Array', 'Prefix Sum'],
  'Given an integer array nums, return an array answer where answer[i] is the product of every element of nums except nums[i]. The algorithm must run in O(n) time without using division.',
  'class Solution:\n    def productExceptSelf(self, nums: List[int]) -> List[int]:\n        pass',
  'Solution().productExceptSelf',
  '{
    "inputs": ["nums = [1,2,3,4]", "nums = [-1,1,0,-3,3]"],
    "outputs": ["[24,12,8,6]", "[0,0,9,0,0]"]
  }'::jsonb,
  'from typing import List, Optional, Dict, Tuple\nimport math\nimport heapq\nimport collections\nfrom collections import defaultdict, Counter, deque\n\nclass Solution:\n    def productExceptSelf(self, nums: List[int]) -> List[int]:\n',
  'def check(candidate):\n    assert candidate(nums = [1,2,3,4]) == [24,12,8,6]\n    assert candidate(nums = [-1,1,0,-3,3]) == [0,0,9,0,0]'
)
ON CONFLICT (task_id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  difficulty = EXCLUDED.difficulty,
  tags = EXCLUDED.tags,
  problem_description = EXCLUDED.problem_description,
  starter_code = EXCLUDED.starter_code,
  entry_point = EXCLUDED.entry_point,
  input_output = EXCLUDED.input_output,
  prompt = EXCLUDED.prompt,
  test = EXCLUDED.test;