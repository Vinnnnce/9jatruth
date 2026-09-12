package com.ninejatruth.app.presentation.politics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.domain.model.Candidate
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.components.ErrorView
import com.ninejatruth.app.presentation.components.LoadingIndicator
import com.ninejatruth.app.presentation.components.TruthScoreBadge
import com.ninejatruth.app.presentation.theme.NigeriaGreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CandidateDetailUiState(
    val isLoading: Boolean = false,
    val candidate: Candidate? = null,
    val error: String? = null
)

@HiltViewModel
class CandidateDetailViewModel @Inject constructor(
    private val politicsRepository: PoliticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CandidateDetailUiState())
    val uiState: StateFlow<CandidateDetailUiState> = _uiState.asStateFlow()

    fun loadCandidate(candidateId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            politicsRepository.getCandidate(candidateId).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = CandidateDetailUiState(candidate = result.data)
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }
}

@Composable
fun CandidateDetailScreen(
    candidateId: String,
    onBack: () -> Unit,
    viewModel: CandidateDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(candidateId) {
        viewModel.loadCandidate(candidateId)
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text("Back", color = NigeriaGreen)
                }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            LoadingIndicator(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        if (uiState.error != null) {
            ErrorView(
                message = uiState.error!!,
                onRetry = { viewModel.loadCandidate(candidateId) },
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val candidate = uiState.candidate ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(containerColor = NigeriaGreen)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = candidate.fullName.take(1).uppercase(),
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = candidate.fullName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    if (candidate.partyName != null) {
                        Text(
                            text = "${candidate.partyAcronym} - ${candidate.partyName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                    if (candidate.officeName != null) {
                        Text(
                            text = candidate.officeName,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                    TruthScoreBadge(score = candidate.truthScore)
                }
            }

            // Bio
            if (candidate.bio != null) {
                Text(
                    text = "About",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = candidate.bio,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            // Education
            if (candidate.education.isNotEmpty()) {
                Text(
                    text = "Education",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                candidate.education.forEach { edu ->
                    Text(
                        text = "- $edu",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Experience
            if (candidate.experience.isNotEmpty()) {
                Text(
                    text = "Experience",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                candidate.experience.forEach { exp ->
                    Text(
                        text = "- $exp",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Promises
            if (candidate.promises.isNotEmpty()) {
                Text(
                    text = "Promises",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                candidate.promises.forEach { promise ->
                    Text(
                        text = "- $promise",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}
