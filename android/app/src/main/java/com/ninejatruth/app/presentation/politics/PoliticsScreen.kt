package com.ninejatruth.app.presentation.politics

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.presentation.components.*

@Composable
fun PoliticsScreen(
    onNavigateToParty: (String) -> Unit,
    onNavigateToCandidate: (String) -> Unit,
    onNavigateToElection: (String) -> Unit,
    viewModel: PoliticsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val tabs = listOf("Parties", "Candidates", "Offices", "Elections")

    Column(modifier = Modifier.fillMaxSize()) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Text(
                text = "Politics",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }

        // Tab Row
        ScrollableTabRow(
            selectedTabIndex = uiState.selectedTab,
            edgePadding = 20.dp
        ) {
            tabs.forEachIndexed { index, tab ->
                Tab(
                    selected = uiState.selectedTab == index,
                    onClick = { viewModel.selectTab(index) },
                    text = { Text(tab, fontWeight = if (uiState.selectedTab == index) FontWeight.SemiBold else FontWeight.Normal) }
                )
            }
        }

        // Content
        if (uiState.isLoading) {
            LoadingIndicator()
            return@Column
        }

        when (uiState.selectedTab) {
            0 -> PartiesTab(uiState.parties, onNavigateToParty)
            1 -> CandidatesTab(uiState.candidates, onNavigateToCandidate)
            2 -> OfficesTab(uiState.offices)
            3 -> ElectionsTab(uiState.elections, onNavigateToElection)
        }
    }
}

@Composable
private fun PartiesTab(parties: List<com.ninejatruth.app.domain.model.Party>, onNavigate: (String) -> Unit) {
    if (parties.isEmpty()) {
        EmptyStateView(title = "No parties yet", subtitle = "Political parties will appear here")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(parties) { party ->
            PartyCard(party = party, onClick = { onNavigate(party.id) })
        }
    }
}

@Composable
private fun CandidatesTab(candidates: List<com.ninejatruth.app.domain.model.Candidate>, onNavigate: (String) -> Unit) {
    if (candidates.isEmpty()) {
        EmptyStateView(title = "No candidates yet", subtitle = "Candidates will appear here")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(candidates) { candidate ->
            CandidateCard(candidate = candidate, onClick = { onNavigate(candidate.id) })
        }
    }
}

@Composable
private fun OfficesTab(offices: List<com.ninejatruth.app.domain.model.Office>) {
    if (offices.isEmpty()) {
        EmptyStateView(title = "No offices yet", subtitle = "Political offices will appear here")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(offices) { office ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = office.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (office.description != null) {
                        Text(
                            text = office.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (office.termLength != null) {
                        Text(
                            text = "Term: ${office.termLength} years" +
                                    if (office.termLimit != null) " (max ${office.termLimit} terms)" else "",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ElectionsTab(elections: List<com.ninejatruth.app.domain.model.Election>, onNavigate: (String) -> Unit) {
    if (elections.isEmpty()) {
        EmptyStateView(title = "No elections yet", subtitle = "Elections will appear here")
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(elections) { election ->
            ElectionCard(election = election, onClick = { onNavigate(election.id) })
        }
    }
}
