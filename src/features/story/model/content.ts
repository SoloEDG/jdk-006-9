import recordings from "./recordings.json";
import type { CaseContent, Episode } from "../../../shared/types";
export const CASE_CONTENT: CaseContent = {
  id: "fog-harbor-1998",
  title: "雾港来电",
  episodes: recordings as Episode[],
  clues: [
    {
      id: "bell",
      title: "三声钟响",
      kind: "环境声音",
      description: "来电中传来的三声金属钟响，与守塔人的说法存在矛盾。",
    },
    {
      id: "horn",
      title: "失踪的渡轮",
      kind: "环境声音",
      description: "已经停航的深夜，码头响起了三长一短的雾笛。",
    },
    {
      id: "static",
      title: "电流中的低语",
      kind: "背景声音",
      description:
        "守塔人家中收音机的异常底噪，可能与那通电话来自同一个信号源。",
    },
    {
      id: "key",
      title: "红色按钮下",
      kind: "录音证词",
      description: "二十年前的磁带，留下了航标被人为关闭的证词。",
    },
  ],
  scenes: [
    {
      id: "arrival",
      title: "迟到的来电",
      location: "雾港电台",
      chapter: "01",
      description: "一通没有号码的求救电话，将你带回二十年前的海难。",
      choices: [
        {
          id: "visit-harbor",
          label: "追查码头的汽笛",
          target: "harbor",
          requires: [],
          description: "询问最后见过渡轮的修船人。",
        },
        {
          id: "visit-keeper",
          label: "拜访守塔人",
          target: "interview",
          requires: [],
          description: "向周姨询问灯塔的秘密。",
        },
      ],
    },
    {
      id: "harbor",
      title: "潮水留下的证词",
      location: "旧码头",
      chapter: "02",
      description: "停航以后的雾笛，是谁在回应？",
      choices: [
        {
          id: "ask-keeper",
          label: "带着疑问拜访守塔人",
          target: "interview",
          requires: [],
          description: "核对那晚的异常声音。",
        },
        {
          id: "return-radio",
          label: "重听那通神秘来电",
          target: "arrival",
          requires: [],
          description: "仔细辨认电话背景里的钟声。",
        },
      ],
    },
    {
      id: "interview",
      title: "守塔人的沉默",
      location: "周姨的旧宅",
      chapter: "03",
      description: "有些沉默，比回答更接近真相。",
      choices: [
        {
          id: "enter-tower",
          label: "沿北楼梯调查灯塔",
          target: "tower",
          requires: [],
          description: "进入曾经关闭的控制室。",
        },
        {
          id: "check-call",
          label: "回电台核对钟声",
          target: "arrival",
          requires: [],
          description: "重新收集电话里遗漏的声音。",
        },
        {
          id: "check-horn",
          label: "到码头核对汽笛",
          target: "harbor",
          requires: [],
          description: "查证守塔人的时间线。",
        },
      ],
    },
    {
      id: "tower",
      title: "灯塔里的第二个人",
      location: "废弃灯塔",
      chapter: "04",
      description: "仍在转动的磁带，记录了被潮水掩盖的证词。",
      choices: [
        {
          id: "solve",
          label: "还原那晚的真相",
          target: "finale",
          requires: ["bell", "horn", "key"],
          description: "需要钟声、汽笛和旧磁带三份证据。",
        },
        {
          id: "revisit-keeper",
          label: "再次询问守塔人",
          target: "interview",
          requires: [],
          description: "已掌握线索会改变对方的回答。",
        },
        {
          id: "revisit-harbor",
          label: "补查码头的证词",
          target: "harbor",
          requires: [],
          description: "寻找仍然缺失的声音线索。",
        },
      ],
    },
    {
      id: "finale",
      title: "尚未结束的广播",
      location: "雾港电台",
      chapter: "05",
      description: "让沉默二十年的声音，重新被听见。",
      choices: [
        {
          id: "review-case",
          label: "返回来电，重新梳理",
          target: "arrival",
          requires: [],
          description: "保留笔记与证据，重听最初的录音。",
        },
      ],
    },
  ],
};
