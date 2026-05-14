const escalationRules = [
  {
    reason: "money_or_contract",
    pattern:
      /\b(contract|agreement|terms|legal terms|deposit|payment|pay\b|paid\b|invoice|refund|fee|rate|quote|pricing|commission|revenue|payment dispute|chargeback|guarantee|guaranteed|booked|booking|hire|hired)\b|\$/i,
  },
  {
    reason: "permits_or_legal",
    pattern:
      /\b(permit|permits|license|licensed|liability|insurance|insured|legal|lawyer|attorney|lawsuit|waiver|terms|contractual|compliance)\b/i,
  },
  {
    reason: "safety_or_security",
    pattern:
      /\b(security|medical|medic|injury|injured|first aid|fire|pyro|weapon|weapons|gun|knife|fight|unsafe|evacuation|crowd crush|stampede|emergency)\b/i,
  },
  {
    reason: "regulated_or_sensitive",
    pattern:
      /\b(alcohol|liquor|beer|weed|cannabis|drug|minor|minors|underage|child|children|sexual|explicit|adult content|sex party|harass|harassment|discriminat(?:e|es|ion|ory|ing))\b/i,
  },
  {
    reason: "illegal_or_abusive",
    pattern:
      /\b(illegal|scam|fraud|steal|threaten|kill|hate|slur|stalker|dox|spam)\b/i,
  },
  {
    reason: "contact_dispute",
    pattern:
      /\b(who gave you my number|why did you contact me|do not contact|don't contact|remove me|reported as spam)\b/i,
  },
  {
    reason: "firm_guarantee_request",
    pattern:
      /\b(guarantee attendance|guarantee revenue|guarantee sales|guarantee ticket|guaranteed ticket|guarantee booking|guarantee venue|guarantee celebrity|guarantee influencer|celebrity participation|influencer participation|promise me|confirmed venue|confirmed team|venue access)\b/i,
  },
];

export function assessMessageSafety(body: string) {
  const flags = escalationRules
    .filter((rule) => rule.pattern.test(body))
    .map((rule) => rule.reason);

  return {
    needsAdmin: flags.length > 0,
    flags,
  };
}

export function escalationHoldingReply() {
  return "I want to make sure we handle that carefully. I'm going to flag this for a human on the Saga team and we'll follow up before moving forward.";
}

export function optOutReply() {
  return "Got it. You're opted out and Saga won't text this number again.";
}

export function optInReply() {
  return "You're opted back in. Send your project idea when you're ready and Saga will pick it up from there.";
}

export function softConfusionReply() {
  return "I want to make sure I handle that carefully, so I'm going to pause and have a human review before replying.";
}
