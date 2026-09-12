package com.ninejatruth.app.domain.model

data class State(
    val id: String,
    val name: String,
    val code: String?,
    val region: String?,
    val capital: String?,
    val population: Long?
)

data class Lga(
    val id: String,
    val name: String,
    val stateId: String,
    val headquarters: String?
)

data class Ward(
    val id: String,
    val name: String,
    val lgaId: String
)

data class Community(
    val id: String,
    val name: String,
    val wardId: String,
    val population: Long?
)
