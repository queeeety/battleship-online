## Summary

<!-- What does this MR do and why? One or two sentences. -->

**Build stage:** <!-- e.g. 1. Rules and classes (see "Build order" in the tech design) -->
**Related issue:** <!-- #123, or "none" -->

## Classes touched

<!-- Which classes changed. Call out anything outside your own area, and tag its owner. -->

| Class / file | Owner | What changed |
| --- | --- | --- |
|  |  |  |

## Design changes

<!--
Anything that now differs from what we documented: the UML (docs/uml), the CRC cards,
the requirements spec or the tech design doc. Tick every box that applies, then list
each change in the table so the docs can be brought back in line.
-->

**Reference docs:** [Tech design doc](https://docs.google.com/document/d/1R3S3VhuUzgUJUNVGs8mgUITunHbGeH3u_3mQNCmNeqw/edit?tab=t.dbq53rnylz67) · [UML diagrams](https://gitlab.computing.dcu.ie/nathan.pascale2/ooad-battleship-project2026/-/tree/main/docs/uml) · [Progress checklist](https://docs.google.com/document/d/1R3S3VhuUzgUJUNVGs8mgUITunHbGeH3u_3mQNCmNeqw/edit?tab=t.7773udk3yp9r)

- [ ] Added methods, fields or classes that aren't in the UML / CRC cards
- [ ] Changed a signature from the UML (parameters, return types, visibility)
- [ ] Changed a rule or behaviour from the requirements or the tech design
- [ ] Changed the database schema
- [ ] Changed a shared contract another person codes against
- [ ] None, this matches the docs as they are

| Change | Where it was documented | Why | Docs updated? |
| --- | --- | --- | --- |
|  | <!-- e.g. docs/uml/class/refinedClassDiagrams/2_5_BoardFleet.puml --> |  | <!-- yes, in this MR / no, @owner to update --> |

**Who needs to know:** <!-- Tim for UML, whoever owns the doc or the class you changed -->

## Testing

- [ ] Unit tests added or updated for the changed rules
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` has no new errors
- [ ] Manual checks, if relevant: cheat check / reload check / concurrency check

<!-- Anything you tested by hand, or couldn't test yet and why. -->

## Checklist

- [ ] Branched off `main` with a descriptive name
- [ ] No secrets, `.env` files or personal config committed
- [ ] Reviewer assigned
- [ ] Progress checklist updated (tick anything this MR finishes)
