import { ChannelType, GuildMember, VoiceChannel, type CategoryChannel } from "discord.js";

import { PrivateVoice, type VoiceConfig } from "./PrivateVoice";
import { open } from "lmdb";

export const configStore = open<VoiceConfig, string>({
  path: './configs',
  compression: true
});

export class PrivateGroup {
  voices = new Set<PrivateVoice>();

  constructor(
    public root: CategoryChannel,
    public create: VoiceChannel[],
    public deleteTimeout: number,
  ) { }

  addVoice(voice: VoiceChannel, owner: GuildMember | string) {
    const newVoice = new PrivateVoice(
      this,
      voice,
      owner instanceof GuildMember ? owner.id : owner,
      this.deleteTimeout
    );
    this.voices.add(newVoice);
    return newVoice;
  }

  getId(owner: GuildMember | string) {
    if (owner instanceof GuildMember)
      owner = owner.id;

    return [
      this.root.guild.id,
      this.root.id,
      owner
    ].join(':');
  }

  async loop() {
    for (const create of this.create) {
      for (const [, member] of create.members) {
        let channel = [...this.voices].find(e => e.ownerId === member.id)?.voice ?? await (
          async () => {
            const config = configStore.get(this.getId(member));

            const channel = await this.root.guild.channels.create({
              name: config?.name ?? member.user.username,
              bitrate: config?.bitrate ?? undefined,
              rtcRegion: config?.region ?? undefined,
              userLimit: config?.limit ?? undefined,
              nsfw: config?.nsfw ?? undefined,
              videoQualityMode: config?.video ?? undefined,
              parent: this.root,
              type: ChannelType.GuildVoice,
            });

            await channel.permissionOverwrites.create(
              member,
              {
                ManageChannels: true,
                MoveMembers: true,
                ManageMessages: true
              }
            );
            return channel;
          }
        )();
        await member.voice.setChannel(channel);
        this.addVoice(channel, member);
      }
    }

    for (const voice of this.voices)
      await voice.loop();
  }
}