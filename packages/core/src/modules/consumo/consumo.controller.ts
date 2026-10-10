import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Granularidade } from "@gas/types";

import { AutenticadoGuard } from "../identidade/autenticado.guard";
import { ConviteService } from "../identidade/convite.service";
import { CriarConviteDto } from "../identidade/dto";
import { EscopoService, type UsuarioAutenticado } from "../identidade/escopo.service";
import { UsuarioAtual } from "../identidade/usuario-atual.decorator";
import { ConsumoService } from "./consumo.service";

/** Visão da unidade: morador com vínculo vigente ou admin do condomínio (RN-004). */
@ApiTags("unidades")
@ApiBearerAuth()
@UseGuards(AutenticadoGuard)
@Controller("unidades/:unidadeId")
export class UnidadeController {
  constructor(
    private readonly escopo: EscopoService,
    private readonly consumo: ConsumoService,
  ) {}

  @Get("resumo")
  async resumo(@UsuarioAtual() u: UsuarioAutenticado, @Param("unidadeId", ParseUUIDPipe) unidadeId: string) {
    const a = await this.escopo.acessoUnidade(u, unidadeId);
    return this.consumo.resumoUnidade(unidadeId, a.condominioId, a.desde);
  }

  @Get("consumo")
  @ApiQuery({ name: "granularidade", enum: ["hora", "dia", "mes"] })
  @ApiQuery({ name: "de", description: "AAAA-MM-DD, no fuso do condomínio" })
  @ApiQuery({ name: "ate", description: "AAAA-MM-DD, exclusivo" })
  async serie(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @Query("granularidade") gran: Granularidade,
    @Query("de") de: string,
    @Query("ate") ate: string,
  ) {
    const a = await this.escopo.acessoUnidade(u, unidadeId);
    return { granularidade: gran, de, ate, serie: await this.consumo.serieUnidade(unidadeId, a.condominioId, gran, de, ate, a.desde) };
  }
}

/** Visão do condomínio: só admin do condomínio ou operador (RN-003). */
@ApiTags("condominios")
@ApiBearerAuth()
@UseGuards(AutenticadoGuard)
@Controller("condominios/:condominioId")
export class CondominioController {
  constructor(
    private readonly escopo: EscopoService,
    private readonly consumo: ConsumoService,
    private readonly convites: ConviteService,
  ) {}

  @Get("painel")
  async painel(@UsuarioAtual() u: UsuarioAutenticado, @Param("condominioId", ParseUUIDPipe) id: string) {
    await this.escopo.exigirAdmin(u, id);
    return this.consumo.painelCondominio(id);
  }

  @Get("unidades")
  async unidades(@UsuarioAtual() u: UsuarioAutenticado, @Param("condominioId", ParseUUIDPipe) id: string) {
    await this.escopo.exigirAdmin(u, id);
    return this.consumo.unidadesDoCondominio(id);
  }

  @Get("moradores")
  async moradores(@UsuarioAtual() u: UsuarioAutenticado, @Param("condominioId", ParseUUIDPipe) id: string) {
    await this.escopo.exigirAdmin(u, id);
    return this.consumo.moradoresDoCondominio(id);
  }

  @Post("convites")
  async convidar(@UsuarioAtual() u: UsuarioAutenticado, @Param("condominioId", ParseUUIDPipe) id: string, @Body() dto: CriarConviteDto) {
    await this.escopo.exigirAdmin(u, id);
    return this.convites.criar(id, dto, u.id);
  }
}
