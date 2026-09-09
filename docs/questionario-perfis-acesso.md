# Questionário — Perfis de acesso ao Gerenciador PROPESP

---

## Por que este questionário

O Gerenciador já sabe **o que cada pessoa pode fazer**: quem cadastra uma missão,
quem aprova, quem valida uma prestação de contas. Essa parte está implementada e
funcionando.

Falta a outra metade da mesma pergunta: **o que cada pessoa pode ver.**

Hoje, qualquer pessoa que entra no sistema enxerga o planejamento, o orçamento e
a lista de bolsistas de **todos os 24 PPGs e das três redes** — inclusive CPF e
e-mail dos bolsistas. Isso não incomodou até agora porque só a equipe da PROPESP
tem conta. Passa a incomodar no dia em que coordenadores de PPG e gestores de
rede receberem acesso, que é justamente o próximo passo previsto.

O sistema já tem o mecanismo pronto para limitar o que cada um enxerga. O que
falta é **a decisão de vocês sobre onde traçar a linha**. É só isso que este
documento pergunta.

Nenhuma pergunta aqui é técnica. Responda pensando em duas coisas: **o que cada
pessoa precisa ver para fazer o próprio trabalho**, e **o que seria constrangedor
alguém ver sem precisar**.

---

## Como o sistema já funciona nas missões

No módulo de missões do Comitê Gestor, já está implementado assim:

| Perfil | O que enxerga nas missões |
|---|---|
| **Administrador (PROPESP)** | tudo, nas três redes |
| **Gestor da Rede** | as missões da rede a que está vinculado |
| **Comitê Gestor** | lê as missões das três redes, porque precisa decidir sobre todas; não altera o que julga |
| **Participante** | apenas as missões de que participa (previsto para fase posterior) |

E: **a prestação de contas é validada pelo Administrador**, não pelo Comitê.

Essas linhas valem para o **módulo de missões**. As perguntas abaixo tratam do
**resto do sistema**: planejamento, orçamento, bolsistas e pendências — que hoje
não têm nenhuma limitação.

---

## Como responder

Marque **uma opção por pergunta**. Se nenhuma servir, escreva a sua em "Outra".
Onde houver espaço para justificativa, uma frase basta — ela vira a explicação
registrada no sistema, lida por quem for atendido ou barrado depois.

Onde estiver escrito **(sugerida)**, é a nossa recomendação técnica. Discordar
dela é esperado e não custa nada: mudar isso agora é barato, mudar depois de
todo mundo ter conta é caro.

---

## Bloco 1 — Quem entra no sistema

**1.1 — A lista de perfis está correta?**

| Perfil | Quem é, na prática |
|---|---|
| Administrador | equipe da PROPESP que administra o sistema |
| Secretaria | apoio administrativo da PROPESP; registra, não decide |
| Coordenação de PPG | coordenador do programa de pós-graduação |
| Gestor da Rede | responsável por uma das três redes (UFMG, UNESP, UNICAMP) |
| Comitê Gestor | quem analisa e decide sobre as missões |
| Docente | membro de comitê temático, acompanha uma área |
| Discente | consulta |

- [ ] (a) A lista está correta
- [ ] (b) Falta um perfil: ______________________________
- [ ] (c) Um destes não deve existir: ____________________

**1.2 — Alguém de fora da UEA precisará entrar no sistema?**
(parceiro internacional, consultor, CAPES, auditoria externa)

- [ ] (a) Não, por enquanto **(sugerida)**
- [ ] (b) Sim: ________________________________________
  E deveria ver: ______________________________________

---

## Bloco 2 — O que cada perfil enxerga

Nas perguntas deste bloco, as respostas possíveis são sempre do mesmo tipo:
**tudo**, **só o que é meu** (meu PPG, minha rede, minha temática) ou **não vê**.

**2.1 — Coordenação de PPG: planejamento e orçamento**

- [ ] (a) Só as linhas do próprio PPG **(sugerida)**
- [ ] (b) Vê a rede inteira, mas só altera o próprio PPG
- [ ] (c) Vê tudo, como hoje
- [ ] (d) Outra: _______________________________________

Justificativa: ________________________________________

**2.2 — Coordenação de PPG: bolsistas**

- [ ] (a) Só os bolsistas do próprio PPG **(sugerida)**
- [ ] (b) Todos os bolsistas do ciclo
- [ ] (c) Outra: _______________________________________

**2.3 — Gestor da Rede: planejamento e orçamento**

Nas missões ele já é limitado à própria rede. E no planejamento?

- [ ] (a) Só a própria rede, em leitura **(sugerida)**
- [ ] (b) Só a própria rede, e também pode alterar
- [ ] (c) Vê o planejamento das três redes em leitura
- [ ] (d) Outra: _______________________________________

**2.4 — Docente / membro de comitê temático**

- [ ] (a) Só a área temática que acompanha **(sugerida)**
- [ ] (b) A rede inteira a que a temática pertence
- [ ] (c) Tudo, em leitura
- [ ] (d) Não deveria ter acesso ao sistema

**2.5 — Secretaria**

- [ ] (a) Enxerga tudo, como o Administrador — é apoio da PROPESP **(sugerida)**
- [ ] (b) Limitada por rede: _____________________________
- [ ] (c) Outra: _______________________________________

**2.6 — Discente**

Hoje o perfil existe e enxerga todo o planejamento, o orçamento e a lista de
bolsistas com CPF. Quase certamente não é o que se quis.

- [ ] (a) Deve ver apenas os próprios dados e a própria bolsa. Como isso depende
      do perfil Participante (Bloco 6), o acesso fica suspenso até lá **(sugerida)**
- [ ] (b) Continua vendo o planejamento e o orçamento, sem nenhum dado pessoal
- [ ] (c) O perfil não deve existir por enquanto
- [ ] (d) Outra: _______________________________________

**2.7 — Existe alguma informação que ninguém além do Administrador deveria ver?**

_______________________________________________________

---

## Bloco 3 — Dados pessoais

**3.1 — CPF do bolsista**

Proposta: veem o CPF completo o Administrador, a Secretaria e a coordenação do
PPG do próprio bolsista. Os demais veem mascarado (`***.456.789-**`).

- [ ] (a) De acordo **(sugerida)**
- [ ] (b) Também deve ver completo: ______________________
- [ ] (c) Ninguém além do Administrador
- [ ] (d) Outra: _______________________________________

**3.2 — E-mail e telefone** (de bolsistas e de contatos de instituições parceiras)

- [ ] (a) Mesmo critério do CPF **(sugerida)**
- [ ] (b) Podem ser vistos por quem já vê a pessoa na lista
- [ ] (c) Outra: _______________________________________

**3.3 — Documentos pessoais**
(RG ou CIN, CPF, passaporte, comprovante de residência, plano de trabalho)

Ainda não é possível anexá-los ao sistema; será. Quem poderá abri-los?

- [ ] (a) Administrador e Secretaria **(sugerida)**
- [ ] (b) Os dois acima e a coordenação do PPG do bolsista
- [ ] (c) Outra: _______________________________________

**3.4 — Fotos de missão em que aparecem pessoas**

- [ ] (a) Visíveis a todos os perfis que já veem a missão **(sugerida)**
- [ ] (b) Restritas ao Administrador e ao Comitê
- [ ] (c) Depende de autorização de uso de imagem assinada — quem controla: ____

---

## Bloco 4 — A virada da chave

Hoje, conta **sem definição de acesso enxerga tudo**. É o oposto do seguro, e foi
proposital: ligar a restrição antes de definir quem vê o quê deixaria todo
coordenador sem enxergar nada, no mesmo instante e sem explicação.

Trocar isso é uma decisão de data, não de programação. Depois da virada,
**conta sem definição não vê nada.**

**4.1 — Quem atribui o acesso de cada pessoa** (dizer quais PPGs ou redes cada
conta enxerga)?

- [ ] (a) Uma pessoa da PROPESP designada: __________________ **(sugerida)**
- [ ] (b) Qualquer Administrador
- [ ] (c) Outra: _______________________________________

**4.2 — Data-alvo para a virada:** ____ / ____ / ______

Antes dela, precisamos de vocês de uma lista: cada conta e qual PPG ou rede ela
enxerga. Podemos gerar a lista das contas existentes para vocês preencherem ao
lado — basta pedir.

**4.3 — Conta que ficar sem definição no dia da virada:**

- [ ] (a) Deixa de ver dados até alguém definir **(sugerida — é o comportamento seguro)**
- [ ] (b) Continua vendo tudo até ser definida

**4.4 — Quem deve ser avisado** quando alguém perder acesso a algo que via antes?

_______________________________________________________

---

## Bloco 5 — Por quanto tempo guardar

**5.1 — Retenção**

Já decidido: documentos de missão guardados por **4 anos** após o encerramento do
ciclo. Proposta para os dados pessoais (CPF, e-mail, telefone): **anonimizar após
o mesmo prazo**, preservando os números e indicadores históricos — os relatórios
continuam corretos, mas deixa de ser possível dizer de quem era o CPF.

- [ ] (a) De acordo **(sugerida)**
- [ ] (b) Prazo diferente: ____ anos, porque ______________
- [ ] (c) Exige parecer jurídico / LGPD antes. Responsável: __________

**5.2 — Existe norma da UEA, da CAPES ou do comitê de ética que devamos seguir
nisso?**

_______________________________________________________

---

## Bloco 6 — Perfil Participante

É o perfil de quem participa de uma missão ou tem uma bolsa e entra no sistema
para ver **apenas o que é seu**: a própria viagem, a própria prestação, os
próprios documentos.

Ele está previsto e modelado, mas proposto para uma fase posterior — dar a
alguém acesso ao próprio documento pessoal exige antes fechar o Bloco 3 e o
Bloco 5.

- [ ] (a) De acordo, fica para depois **(sugerida)**
- [ ] (b) É prioritário. Por quê: ________________________

---

## Anexo — Matriz para preencher

Se preferirem responder de uma vez só, preencham a tabela. Use:
**T** = vê tudo · **M** = vê só o que é meu (meu PPG / minha rede / minha
temática) · **N** = não vê

| Perfil | Planejamento e orçamento | Bolsistas | Missões | Parceiros | Prestação de contas | Documentos pessoais |
|---|---|---|---|---|---|---|
| Administrador | T | T | T | T | T (valida) | T |
| Secretaria | | | | | | |
| Coordenação de PPG | | | | | | |
| Gestor da Rede | | | T (só a sua rede) | T | M | |
| Comitê Gestor | | | T (lê as três) | T | T (lê, não valida) | |
| Docente | | | | | | |
| Discente | | | | | | |

As células já preenchidas são como o sistema já funciona hoje. Mexam apenas se
discordarem.

---

## O que acontece depois que vocês responderem

1. Transformamos as respostas em uma tabela única de perfis e acessos, e
   devolvemos para conferência antes de programar qualquer coisa.
2. Programamos a limitação, uma tela por vez, com verificação em cada uma.
3. Vocês nos passam a lista de contas com o PPG ou a rede de cada uma.
4. Na data do item 4.2, a restrição é ligada.

Enquanto isso, nada muda: o sistema continua funcionando como está hoje.
